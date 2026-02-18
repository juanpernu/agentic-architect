# Bank Accounts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow organizations to register bank accounts and link receipts to the account used for each expense.

**Architecture:** New `bank_accounts` table following the Cost Centers pattern (soft-delete, org-scoped, RLS). New settings tab, API routes, and integration into receipt detail/upload/list pages.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), SWR, Zod, shadcn/ui, Clerk auth

---

### Task 1: Database Migration

**Files:**
- Create: `packages/db/migrations/006_bank_accounts.sql`

**Step 1: Write the migration**

```sql
-- Bank Accounts table
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  cbu TEXT,
  alias TEXT,
  currency TEXT NOT NULL DEFAULT 'ARS',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_accounts_org_id ON bank_accounts(organization_id);

CREATE TRIGGER set_updated_at_bank_accounts
  BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for bank_accounts
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view bank accounts"
  ON bank_accounts FOR SELECT
  USING (organization_id = public.get_org_id());

CREATE POLICY "Admin can insert bank accounts"
  ON bank_accounts FOR INSERT
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "Admin can update bank accounts"
  ON bank_accounts FOR UPDATE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "Admin can delete bank accounts"
  ON bank_accounts FOR DELETE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );

-- Add bank_account_id to receipts
ALTER TABLE receipts ADD COLUMN bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX idx_receipts_bank_account_id ON receipts(bank_account_id);
```

**Step 2: Run the migration against Supabase**

Run the SQL in the Supabase SQL Editor (Dashboard → SQL Editor → paste and run).

**Step 3: Commit**

```bash
git add packages/db/migrations/006_bank_accounts.sql
git commit -m "feat: add bank_accounts table and receipts FK migration"
```

---

### Task 2: Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add BankAccount interface after CostCenter (line ~107)**

```typescript
export interface BankAccount {
  id: string;
  organization_id: string;
  name: string;
  bank_name: string;
  cbu: string | null;
  alias: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Add `bank_account_id` to Receipt interface (after `cost_center_id` on line 65)**

```typescript
  bank_account_id: string | null;
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit -p packages/shared/tsconfig.json`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add BankAccount type and bank_account_id to Receipt"
```

---

### Task 3: API Types

**Files:**
- Modify: `apps/web/lib/api-types.ts`

**Step 1: Import BankAccount from shared (line 1)**

Change:
```typescript
import type { Project, Receipt, ReceiptItem, ProjectColor, CostCenter } from '@architech/shared';
```
To:
```typescript
import type { Project, Receipt, ReceiptItem, ProjectColor, CostCenter, BankAccount } from '@architech/shared';
```

**Step 2: Add bank_account to ReceiptWithDetails (after cost_center, line ~30)**

```typescript
  bank_account: { id: string; name: string; bank_name: string } | null;
```

**Step 3: Add bank_account to ReceiptDetail (after cost_center, line ~44)**

```typescript
  bank_account: { id: string; name: string; bank_name: string } | null;
```

**Step 4: Verify**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: Errors in pages that use these types (expected — we'll fix them in later tasks)

**Step 5: Commit**

```bash
git add apps/web/lib/api-types.ts
git commit -m "feat: add bank_account to receipt API types"
```

---

### Task 4: Zod Validation Schema

**Files:**
- Create: `apps/web/lib/schemas/bank-account.ts`
- Modify: `apps/web/lib/schemas/index.ts` (if it exists; add export)

**Step 1: Create the schema**

```typescript
import { z } from 'zod';

export const bankAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  bank_name: z.string().min(1, 'El banco es requerido').max(100, 'Máximo 100 caracteres'),
  cbu: z
    .string()
    .regex(/^\d{22}$/, 'El CBU debe tener 22 dígitos')
    .optional()
    .or(z.literal('')),
  alias: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
});
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`

**Step 3: Commit**

```bash
git add apps/web/lib/schemas/bank-account.ts
git commit -m "feat: add bank account Zod validation schema"
```

---

### Task 5: API Routes — CRUD

**Files:**
- Create: `apps/web/app/api/bank-accounts/route.ts`
- Create: `apps/web/app/api/bank-accounts/[id]/route.ts`

**Step 1: Create list + create route**

File: `apps/web/app/api/bank-accounts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const db = getDb();
  const { data, error } = await db
    .from('bank_accounts')
    .select('*')
    .eq('organization_id', ctx.orgId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.name || !(body.name as string).trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }

  if (!body.bank_name || !(body.bank_name as string).trim()) {
    return NextResponse.json({ error: 'El banco es requerido' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('bank_accounts')
    .insert({
      organization_id: ctx.orgId,
      name: (body.name as string).trim(),
      bank_name: (body.bank_name as string).trim(),
      cbu: body.cbu ? (body.cbu as string).trim() : null,
      alias: body.alias ? (body.alias as string).trim() : null,
      currency: body.currency ?? 'ARS',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

**Step 2: Create update + delete route**

File: `apps/web/app/api/bank-accounts/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (body.name !== undefined && !(body.name as string).trim()) {
    return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
  }

  if (body.bank_name !== undefined && !(body.bank_name as string).trim()) {
    return NextResponse.json({ error: 'El banco no puede estar vacío' }, { status: 400 });
  }

  const updateFields: Record<string, unknown> = {};
  if (body.name !== undefined) updateFields.name = (body.name as string).trim();
  if (body.bank_name !== undefined) updateFields.bank_name = (body.bank_name as string).trim();
  if (body.cbu !== undefined) updateFields.cbu = body.cbu ? (body.cbu as string).trim() : null;
  if (body.alias !== undefined) updateFields.alias = body.alias ? (body.alias as string).trim() : null;
  if (body.currency !== undefined) updateFields.currency = body.currency;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('bank_accounts')
    .update(updateFields)
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;
  const db = getDb();

  const { data, error } = await db
    .from('bank_accounts')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`

**Step 4: Commit**

```bash
git add apps/web/app/api/bank-accounts/
git commit -m "feat: add bank accounts CRUD API routes"
```

---

### Task 6: Extend Receipts API — bank_account_id

**Files:**
- Modify: `apps/web/app/api/receipts/[id]/route.ts`
- Modify: `apps/web/app/api/receipts/route.ts`

**Step 1: Add bank_account_id to PATCH handler in `receipts/[id]/route.ts`**

After the `cost_center_id` validation block (line ~98), add:

```typescript
  if (body.bank_account_id !== undefined) {
    if (body.bank_account_id !== null) {
      const { data: validBA } = await db
        .from('bank_accounts')
        .select('id')
        .eq('id', body.bank_account_id as string)
        .eq('organization_id', ctx.orgId)
        .eq('is_active', true)
        .maybeSingle();

      if (!validBA) {
        return NextResponse.json(
          { error: 'Cuenta bancaria no válida o inactiva' },
          { status: 400 }
        );
      }
    }
    updateFields.bank_account_id = body.bank_account_id;
  }
```

**Step 2: Add bank_account join to GET handler in `receipts/[id]/route.ts`**

Change the select on line 14 to include `bank_account`:
```typescript
    .select('*, project:projects!inner(id, name, color, organization_id), uploader:users!uploaded_by(id, full_name), receipt_items(*), cost_center:cost_centers(id, name, color), bank_account:bank_accounts(id, name, bank_name)')
```

**Step 3: Add bank_account join to GET handler in `receipts/route.ts`**

Find the `.select()` call and add `bank_account:bank_accounts(id, name, bank_name)` to the select string.

**Step 4: Verify**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`

**Step 5: Commit**

```bash
git add apps/web/app/api/receipts/
git commit -m "feat: add bank_account_id support to receipts API"
```

---

### Task 7: BankAccountFormDialog Component

**Files:**
- Create: `apps/web/components/bank-account-form-dialog.tsx`

**Step 1: Create the form dialog**

Follow the exact pattern from `cost-center-form-dialog.tsx` but with bank account fields. Key differences:
- Fields: name (required), bank_name (required), cbu (optional, 22 digits), alias (optional), currency (ARS/USD select)
- No color picker
- API endpoint: `/api/bank-accounts`
- Toast messages in Spanish: "Cuenta bancaria creada", "Cuenta bancaria actualizada"

```typescript
'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';
import { sileo } from 'sileo';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { BankAccount } from '@architech/shared';

interface BankAccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccount?: BankAccount;
}

export function BankAccountFormDialog({ open, onOpenChange, bankAccount }: BankAccountFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bank_name: '',
    cbu: '',
    alias: '',
    currency: 'ARS',
  });

  useEffect(() => {
    if (bankAccount) {
      setFormData({
        name: bankAccount.name,
        bank_name: bankAccount.bank_name,
        cbu: bankAccount.cbu ?? '',
        alias: bankAccount.alias ?? '',
        currency: bankAccount.currency,
      });
    } else {
      setFormData({ name: '', bank_name: '', cbu: '', alias: '', currency: 'ARS' });
    }
  }, [bankAccount, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        bank_name: formData.bank_name,
        cbu: formData.cbu || null,
        alias: formData.alias || null,
        currency: formData.currency,
      };

      const response = await fetch(
        bankAccount ? `/api/bank-accounts/${bankAccount.id}` : '/api/bank-accounts',
        {
          method: bankAccount ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al guardar');
      }

      sileo.success({ title: bankAccount ? 'Cuenta bancaria actualizada' : 'Cuenta bancaria creada' });
      await mutate('/api/bank-accounts');
      onOpenChange(false);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bankAccount ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}</DialogTitle>
          <DialogDescription>
            {bankAccount ? 'Actualiza los datos de la cuenta bancaria' : 'Registra una nueva cuenta bancaria de la organización'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ba-name">Nombre <span className="text-red-500">*</span></Label>
            <Input
              id="ba-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Cuenta Corriente Macro"
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ba-bank-name">Banco <span className="text-red-500">*</span></Label>
            <Input
              id="ba-bank-name"
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              placeholder="Ej: Banco Macro"
              maxLength={100}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ba-cbu">CBU</Label>
              <Input
                id="ba-cbu"
                value={formData.cbu}
                onChange={(e) => setFormData({ ...formData, cbu: e.target.value })}
                placeholder="22 dígitos"
                maxLength={22}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-alias">Alias</Label>
              <Input
                id="ba-alias"
                value={formData.alias}
                onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                placeholder="Ej: obra.macro"
                maxLength={50}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS — Peso Argentino</SelectItem>
                <SelectItem value="USD">USD — Dólar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : bankAccount ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`

**Step 3: Commit**

```bash
git add apps/web/components/bank-account-form-dialog.tsx
git commit -m "feat: add BankAccountFormDialog component"
```

---

### Task 8: Settings Page — Bancos Tab

**Files:**
- Create: `apps/web/app/(dashboard)/settings/banks/page.tsx`
- Modify: `apps/web/app/(dashboard)/settings/layout.tsx`

**Step 1: Add the tab to settings layout**

In `layout.tsx`, add to the `tabs` array (after cost-centers):

```typescript
  { href: '/settings/banks', label: 'Bancos', roles: ['admin', 'supervisor'] },
```

**Step 2: Create the banks settings page**

Follow the exact pattern from `settings/cost-centers/page.tsx`. Key differences:
- Table columns: Nombre, Banco, CBU, Alias, Moneda, Acciones
- Uses `BankAccountFormDialog` instead of `CostCenterFormDialog`
- No color indicator column
- CBU displayed with monospace font for readability
- API endpoint: `/api/bank-accounts`
- Permission: `role === 'admin'` for create/edit/delete buttons
- Guard: `isAdminOrSupervisor` to view the page

```typescript
'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Landmark, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import { useCurrentUser } from '@/lib/use-current-user';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BankAccountFormDialog } from '@/components/bank-account-form-dialog';
import type { BankAccount } from '@architech/shared';

export default function BanksPage() {
  const { role, isAdminOrSupervisor } = useCurrentUser();
  const isAdmin = role === 'admin';
  const { data: bankAccounts, error } = useSWR<BankAccount[]>(
    isAdminOrSupervisor ? '/api/bank-accounts' : null,
    fetcher
  );

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | undefined>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isAdminOrSupervisor) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acceso denegado"
        description="No tenés permisos para ver las cuentas bancarias."
      />
    );
  }

  const handleEdit = (ba: BankAccount) => {
    setEditingAccount(ba);
    setShowFormDialog(true);
  };

  const handleCreate = () => {
    setEditingAccount(undefined);
    setShowFormDialog(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/bank-accounts/${deletingId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar');
      }
      sileo.success({ title: 'Cuenta bancaria eliminada' });
      await mutate('/api/bank-accounts');
      setShowDeleteDialog(false);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al eliminar' });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  let content: React.ReactNode;

  if (!bankAccounts && !error) {
    content = <LoadingTable />;
  } else if (error) {
    content = (
      <EmptyState
        icon={Landmark}
        title="Error al cargar cuentas bancarias"
        description="Hubo un problema. Por favor, intenta de nuevo."
      />
    );
  } else if (!bankAccounts || bankAccounts.length === 0) {
    content = (
      <EmptyState
        icon={Landmark}
        title="No hay cuentas bancarias"
        description="Registra tu primera cuenta bancaria para vincular egresos."
        action={
          isAdmin ? (
            <Button onClick={handleCreate}>Crear cuenta bancaria</Button>
          ) : undefined
        }
      />
    );
  } else {
    content = (
      <>
        {isAdmin && (
          <div className="flex justify-end mb-4">
            <Button onClick={handleCreate}>Nueva cuenta bancaria</Button>
          </div>
        )}

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead className="hidden md:table-cell">CBU</TableHead>
                <TableHead className="hidden md:table-cell">Alias</TableHead>
                <TableHead>Moneda</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankAccounts.map((ba) => (
                <TableRow key={ba.id}>
                  <TableCell className="font-medium">{ba.name}</TableCell>
                  <TableCell>{ba.bank_name}</TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">
                    {ba.cbu || '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {ba.alias || '—'}
                  </TableCell>
                  <TableCell>{ba.currency}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(ba)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(ba.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <>
      {content}

      <BankAccountFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        bankAccount={editingAccount}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Cuenta Bancaria</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Los comprobantes vinculados conservarán la referencia pero no se podrá seleccionar en nuevos comprobantes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`

**Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/banks/page.tsx apps/web/app/\(dashboard\)/settings/layout.tsx
git commit -m "feat: add banks settings page and tab"
```

---

### Task 9: Receipt Detail — Bank Account Field

**Files:**
- Modify: `apps/web/app/(dashboard)/receipts/[id]/page.tsx`

**Step 1: Add BankAccount import**

Add to the `@architech/shared` import:
```typescript
import type { CostCenter, BankAccount } from '@architech/shared';
```

Add `Landmark` to the lucide-react import.

**Step 2: Add useSWR for bank accounts**

After the `costCenters` SWR call (line ~79):
```typescript
  const { data: bankAccounts } = useSWR<BankAccount[]>('/api/bank-accounts', fetcher);
```

**Step 3: Add state for bank account selection**

After the `isSavingCostCenter` state:
```typescript
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [isSavingBankAccount, setIsSavingBankAccount] = useState(false);
```

**Step 4: Add handleSaveBankAccount handler**

After `handleSaveCostCenter`:
```typescript
  const handleSaveBankAccount = async () => {
    if (!selectedBankAccountId) return;
    setIsSavingBankAccount(true);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_account_id: selectedBankAccountId }),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al asignar cuenta bancaria');
      }
      sileo.success({ title: 'Cuenta bancaria asignada' });
      await mutate(`/api/receipts/${receiptId}`);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al asignar' });
    } finally {
      setIsSavingBankAccount(false);
    }
  };
```

**Step 5: Add bank account field to the metadata grid**

After the Centro de Costos `</div>` block (line ~335), add:

```tsx
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-muted-foreground">
                    <Landmark className="h-3.5 w-3.5" />
                    Cuenta Bancaria
                  </Label>
                  {receipt.bank_account ? (
                    <div className="text-sm font-medium">
                      {receipt.bank_account.name}
                      <span className="text-muted-foreground ml-1">({receipt.bank_account.bank_name})</span>
                    </div>
                  ) : isAdminOrSupervisor ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                        <SelectTrigger className="w-full sm:w-[220px]">
                          <SelectValue placeholder="Asignar cuenta" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts?.map((ba) => (
                            <SelectItem key={ba.id} value={ba.id}>
                              {ba.name} ({ba.bank_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedBankAccountId && (
                        <Button size="sm" onClick={handleSaveBankAccount} disabled={isSavingBankAccount}>
                          {isSavingBankAccount ? 'Guardando...' : 'Asignar'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin asignar</span>
                  )}
                </div>
```

**Step 6: Verify**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`

**Step 7: Commit**

```bash
git add apps/web/app/\(dashboard\)/receipts/\[id\]/page.tsx
git commit -m "feat: add bank account field to receipt detail page"
```

---

### Task 10: Receipt Upload — Bank Account Select

**Files:**
- Modify: `apps/web/components/receipt-review.tsx`

**Step 1: Add BankAccount import**

Add `BankAccount` to the `@architech/shared` import on line 45.

**Step 2: Add useSWR and state for bank accounts**

After the `costCenterId` state (~line 77):
```typescript
  const [bankAccountId, setBankAccountId] = useState('');
```

Add SWR call near the existing project/cost-center fetches:
```typescript
  const { data: bankAccounts } = useSWR<BankAccount[]>('/api/bank-accounts', fetcher);
```

**Step 3: Add bank_account_id to the confirm payload**

In the `handleConfirm` function, add `bank_account_id: bankAccountId || undefined` to the `ConfirmReceiptInput` payload (near `cost_center_id`).

Note: Also update `ConfirmReceiptInput` in `packages/shared/src/types.ts` to include `bank_account_id?: string`.

**Step 4: Add the Select UI**

After the Centro de Costos select in the JSX, add a similar select for bank accounts:

```tsx
<div className="space-y-2">
  <Label>Cuenta Bancaria (opcional)</Label>
  <Select value={bankAccountId} onValueChange={setBankAccountId}>
    <SelectTrigger>
      <SelectValue placeholder="Seleccionar cuenta bancaria" />
    </SelectTrigger>
    <SelectContent>
      {bankAccounts?.map((ba) => (
        <SelectItem key={ba.id} value={ba.id}>
          {ba.name} ({ba.bank_name})
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Step 5: Verify**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`

**Step 6: Commit**

```bash
git add apps/web/components/receipt-review.tsx packages/shared/src/types.ts
git commit -m "feat: add bank account select to receipt upload flow"
```

---

### Task 11: Receipts List — Column and Filter

**Files:**
- Modify: `apps/web/app/(dashboard)/receipts/page.tsx`

**Step 1: Add BankAccount import and SWR**

Add `BankAccount` to the `@architech/shared` import. Add SWR call:
```typescript
  const { data: bankAccounts } = useSWR<BankAccount[]>('/api/bank-accounts', fetcher);
```

**Step 2: Add filter state**

```typescript
  const [bankAccountFilter, setBankAccountFilter] = useState<string>('all');
```

**Step 3: Add filter logic to useMemo**

In the `filteredReceipts` useMemo, add:
```typescript
      const matchesBankAccount =
        bankAccountFilter === 'all' || receipt.bank_account_id === bankAccountFilter;
```
And include `matchesBankAccount` in the return statement and `bankAccountFilter` in the deps array.

**Step 4: Add filter dropdown in the filter bar**

After the cost center filter `<Select>`, add:

```tsx
<Select value={bankAccountFilter} onValueChange={setBankAccountFilter}>
  <SelectTrigger className="w-full sm:w-[220px]">
    <SelectValue placeholder="Cuenta Bancaria" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todas las cuentas</SelectItem>
    {bankAccounts?.map((ba) => (
      <SelectItem key={ba.id} value={ba.id}>
        {ba.name} ({ba.bank_name})
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Step 5: Add table column**

After the "Centro de Costos" `<TableHead>`, add:
```tsx
<TableHead className="hidden xl:table-cell">Banco</TableHead>
```

After the cost center `<TableCell>`, add:
```tsx
<TableCell className="hidden xl:table-cell text-muted-foreground">
  {receipt.bank_account ? receipt.bank_account.name : '—'}
</TableCell>
```

**Step 6: Update footer colSpan**

Adjust the colSpan values in `<TableFooter>` to account for the new column. Add a hidden cell for the bank column:
```tsx
<TableCell className="hidden xl:table-cell" />
```

**Step 7: Add bankAccountFilter to empty state condition**

Add `|| bankAccountFilter !== 'all'` to the filter check in the EmptyState description.

**Step 8: Verify**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`

**Step 9: Commit**

```bash
git add apps/web/app/\(dashboard\)/receipts/page.tsx
git commit -m "feat: add bank account column and filter to receipts list"
```

---

### Task 12: Final Verification

**Step 1: Full type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

**Step 2: Start dev server and verify manually**

Run: `npm run dev`

Test checklist:
- [ ] /settings/banks — create, edit, delete a bank account
- [ ] /receipts/[id] — assign bank account from detail page
- [ ] /upload — select bank account during upload
- [ ] /receipts — see bank column, use bank filter
- [ ] Verify admin-only permissions for CRUD
- [ ] Verify supervisor can view + assign but not create/edit/delete

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
