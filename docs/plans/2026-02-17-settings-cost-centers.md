# Settings Restructure & Cost Centers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure `/settings` into a tab-based hub with sub-routes (General, Users, Cost Centers), and implement full-stack cost center CRUD with receipt integration.

**Architecture:** Next.js App Router sub-routes with shared layout for tabs. New `cost_centers` table at org level, linked 1:1 to receipts via `cost_center_id`. All roles access `/settings`; tabs filtered by role.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), shadcn/ui, SWR, Tailwind CSS 4, Clerk auth.

---

### Task 1: DB Migration — cost_centers table + receipts FK

**Files:**
- Create: `packages/db/migrations/005_cost_centers.sql`

**Context:** Migrations follow sequential numbering (001-004 exist). The `organizations.id` is TEXT (Clerk org IDs). The project uses `gen_random_uuid()` for UUIDs, `update_updated_at()` trigger already exists. RLS pattern uses `public.get_org_id()` and `public.get_user_role()` functions from migration 002.

**Step 1: Write migration**

```sql
-- Cost Centers table
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cost_centers_org_id ON cost_centers(organization_id);

CREATE TRIGGER set_updated_at_cost_centers
  BEFORE UPDATE ON cost_centers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for cost_centers
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view cost centers"
  ON cost_centers FOR SELECT
  USING (organization_id = public.get_org_id());

CREATE POLICY "Admin and supervisor can insert cost centers"
  ON cost_centers FOR INSERT
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "Admin and supervisor can update cost centers"
  ON cost_centers FOR UPDATE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "Admin and supervisor can delete cost centers"
  ON cost_centers FOR DELETE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

-- Add cost_center_id to receipts (nullable for legacy receipts)
ALTER TABLE receipts ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL;
CREATE INDEX idx_receipts_cost_center_id ON receipts(cost_center_id);
```

**Step 2: Commit**

```bash
git add packages/db/migrations/005_cost_centers.sql
git commit -m "feat: add cost_centers table and receipts FK migration"
```

---

### Task 2: Shared types — CostCenter interface + updated types

**Files:**
- Modify: `packages/shared/src/types.ts`

**Context:** Types file exports interfaces for all entities. `ProjectColor` type already exists as `'red' | 'blue' | ... | 'teal'`. `ConfirmReceiptInput` is used by `receipt-review.tsx` when confirming a receipt.

**Step 1: Add CostCenter interface after Supplier interface (~line 95)**

```typescript
export interface CostCenter {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: ProjectColor | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Add cost_center_id to ConfirmReceiptInput**

In `ConfirmReceiptInput` (around line 154), add after `project_id`:

```typescript
cost_center_id: string;
```

This field is **required** — every new receipt must have a cost center.

**Step 3: Build to verify**

Run: `npx turbo build --filter=shared`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add CostCenter type and cost_center_id to ConfirmReceiptInput"
```

---

### Task 3: Cost Centers API — CRUD endpoints

**Files:**
- Create: `apps/web/app/api/cost-centers/route.ts`
- Create: `apps/web/app/api/cost-centers/[id]/route.ts`

**Context:** API pattern: use `getAuthContext()` for auth, return `unauthorized()` / `forbidden()` for access control. Role check: admin and supervisor can create/edit/delete; all roles can read. Color validation uses `VALID_COLORS` array. Supabase queries use `getDb()` from `@/lib/supabase`.

**Step 1: Create list + create endpoint**

File: `apps/web/app/api/cost-centers/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const { data, error } = await db
    .from('cost_centers')
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
  if (ctx.role === 'architect') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.name || !(body.name as string).trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }

  if ((body.name as string).length > 100) {
    return NextResponse.json({ error: 'El nombre no puede exceder 100 caracteres' }, { status: 400 });
  }

  if (body.color && !VALID_COLORS.includes(body.color as string)) {
    return NextResponse.json({ error: `color debe ser uno de: ${VALID_COLORS.join(', ')}` }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('cost_centers')
    .insert({
      organization_id: ctx.orgId,
      name: (body.name as string).trim(),
      description: body.description ? (body.description as string).trim() : null,
      color: body.color ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

**Step 2: Create detail + update + delete endpoint**

File: `apps/web/app/api/cost-centers/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

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

  if (body.name && (body.name as string).length > 100) {
    return NextResponse.json({ error: 'El nombre no puede exceder 100 caracteres' }, { status: 400 });
  }

  if (body.color !== undefined && body.color !== null && !VALID_COLORS.includes(body.color as string)) {
    return NextResponse.json({ error: `color debe ser uno de: ${VALID_COLORS.join(', ')}` }, { status: 400 });
  }

  const db = getDb();

  const updateFields: Record<string, unknown> = {};
  if (body.name !== undefined) updateFields.name = (body.name as string).trim();
  if (body.description !== undefined) updateFields.description = body.description ? (body.description as string).trim() : null;
  if (body.color !== undefined) updateFields.color = body.color;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const { data, error } = await db
    .from('cost_centers')
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
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;
  const db = getDb();

  // Soft-delete: set is_active = false
  const { data, error } = await db
    .from('cost_centers')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
```

**Step 3: Build to verify**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/web/app/api/cost-centers/route.ts apps/web/app/api/cost-centers/\[id\]/route.ts
git commit -m "feat: add cost centers CRUD API endpoints"
```

---

### Task 4: Receipts API updates — cost_center_id support

**Files:**
- Modify: `apps/web/app/api/receipts/route.ts`
- Modify: `apps/web/app/api/receipts/[id]/route.ts`
- Modify: `apps/web/lib/api-types.ts`

**Context:** `POST /api/receipts` creates a receipt. It currently doesn't include `cost_center_id`. `GET /api/receipts` and `GET /api/receipts/[id]` need to join `cost_centers` to return the name/color. There is no PATCH endpoint for receipts yet — we need to create one for editing `cost_center_id` on legacy receipts.

**Step 1: Update POST /api/receipts to include cost_center_id**

In `apps/web/app/api/receipts/route.ts`, in the `POST` handler:

1. Add validation after the existing required-fields check (around line 57):

```typescript
if (!body.cost_center_id) {
  return NextResponse.json(
    { error: 'cost_center_id is required' },
    { status: 400 }
  );
}
```

2. Add `cost_center_id: body.cost_center_id,` to the `.insert()` call (around line 90, after `project_id: body.project_id,`).

**Step 2: Update GET /api/receipts to include cost_center**

In the `GET` handler, update the `.select()` to include cost_center:

Change:
```
'*, project:projects!project_id(id, name, color), uploader:users!uploaded_by(id, full_name)'
```
To:
```
'*, project:projects!project_id(id, name, color), uploader:users!uploaded_by(id, full_name), cost_center:cost_centers(id, name, color)'
```

**Step 3: Update GET /api/receipts/[id] to include cost_center**

In the `GET` handler, update the `.select()`:

Change:
```
'*, project:projects!inner(id, name, color, organization_id), uploader:users!uploaded_by(id, full_name), receipt_items(*)'
```
To:
```
'*, project:projects!inner(id, name, color, organization_id), uploader:users!uploaded_by(id, full_name), receipt_items(*), cost_center:cost_centers(id, name, color)'
```

**Step 4: Add PATCH handler to /api/receipts/[id]/route.ts**

Add after the existing `DELETE` handler:

```typescript
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const db = getDb();

  // Verify receipt belongs to org
  const { data: existing } = await db
    .from('receipts')
    .select('id, projects!inner(organization_id)')
    .eq('id', id)
    .eq('projects.organization_id', ctx.orgId)
    .single();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateFields: Record<string, unknown> = {};
  if (body.cost_center_id !== undefined) updateFields.cost_center_id = body.cost_center_id;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const { data, error } = await db
    .from('receipts')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

**Step 5: Update api-types.ts**

In `apps/web/lib/api-types.ts`:

1. Add `import type { ..., CostCenter }` to the imports from `@architech/shared` (add `CostCenter`).
2. Add to `ReceiptWithDetails`:
```typescript
cost_center: { id: string; name: string; color: ProjectColor | null } | null;
```
3. Add to `ReceiptDetail`:
```typescript
cost_center: { id: string; name: string; color: ProjectColor | null } | null;
```

**Step 6: Build to verify**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add apps/web/app/api/receipts/route.ts apps/web/app/api/receipts/\[id\]/route.ts apps/web/lib/api-types.ts
git commit -m "feat: add cost_center_id to receipts API (POST, PATCH, GET)"
```

---

### Task 5: Settings layout with tabs

**Files:**
- Create: `apps/web/app/(dashboard)/settings/layout.tsx`
- Modify: `apps/web/app/(dashboard)/settings/page.tsx` (replace with redirect)

**Context:** The current `settings/page.tsx` contains both `OrgSettingsForm` and the users table. We need to split it into sub-routes. The layout provides shared UI (header + tabs). Tab visibility depends on role. The sidebar currently filters `/settings` to admin-only — we need to update that.

**Step 1: Create settings layout**

File: `apps/web/app/(dashboard)/settings/layout.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/use-current-user';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ShieldAlert } from 'lucide-react';

const tabs = [
  { href: '/settings/general', label: 'General', roles: ['admin', 'supervisor', 'architect'] },
  { href: '/settings/users', label: 'Usuarios', roles: ['admin'] },
  { href: '/settings/cost-centers', label: 'Centro de Costos', roles: ['admin', 'supervisor'] },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, isLoaded } = useCurrentUser();

  if (!isLoaded) return null;

  const visibleTabs = tabs.filter((tab) => tab.roles.includes(role));

  return (
    <div className="p-6 animate-slide-up">
      <PageHeader title="Ajustes" description="Gestiona tu organización y equipo" />

      <div className="border-b mb-6">
        <nav className="flex gap-4 -mb-px">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'px-1 pb-3 text-sm font-medium border-b-2 transition-colors',
                pathname === tab.href
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}
```

**Step 2: Replace settings/page.tsx with redirect**

Replace the entire contents of `apps/web/app/(dashboard)/settings/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/settings/general');
}
```

**Step 3: Build to verify**

Run: `npx turbo build --filter=web`
Expected: Build succeeds (children routes don't exist yet, but redirect works)

**Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/layout.tsx apps/web/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add settings layout with role-based tabs and redirect"
```

---

### Task 6: General sub-page — move OrgSettingsForm

**Files:**
- Create: `apps/web/app/(dashboard)/settings/general/page.tsx`

**Context:** `OrgSettingsForm` is already a standalone component at `apps/web/components/org-settings-form.tsx`. The general page just needs to render it. All roles can see this page (read-only for architects is handled by the form itself since PATCH requires admin).

**Step 1: Create general page**

File: `apps/web/app/(dashboard)/settings/general/page.tsx`

```tsx
import { OrgSettingsForm } from '@/components/org-settings-form';

export default function SettingsGeneralPage() {
  return <OrgSettingsForm />;
}
```

**Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/general/page.tsx
git commit -m "feat: add /settings/general page with OrgSettingsForm"
```

---

### Task 7: Users sub-page — extract users table

**Files:**
- Create: `apps/web/app/(dashboard)/settings/users/page.tsx`

**Context:** The users table + role management + status toggle logic currently lives in `settings/page.tsx` (which we replaced with a redirect in Task 5). We need to extract all that logic into a new users page. The layout already handles the PageHeader, so the users page should NOT render its own PageHeader. The `InviteUserDialog` button should be at the top of this page. Only admins see the "Usuarios" tab, so this page is admin-only.

**Step 1: Create users page**

File: `apps/web/app/(dashboard)/settings/users/page.tsx`

Copy the full logic from the old `settings/page.tsx` (role change handlers, status toggle, users table), but:
- Remove the `<PageHeader>` (layout provides it)
- Remove the `<OrgSettingsForm />` (moved to general)
- Remove the outer `<div className="p-6 animate-slide-up">` wrapper (layout provides it)
- Keep the admin guard (`if (!isAdmin) return EmptyState`)
- Keep the `InviteUserDialog` button at the top
- Keep all existing imports needed for the user table

```tsx
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useUser } from '@clerk/nextjs';
import { ShieldAlert, Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/lib/use-current-user';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/role-constants';
import { fetcher } from '@/lib/fetcher';
import { toast } from 'sonner';
import { InviteUserDialog } from '@/components/invite-user-dialog';
import type { User, UserRole } from '@architech/shared';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() || '?';
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(dateString));
}

export default function SettingsUsersPage() {
  const { isAdmin, isLoaded } = useCurrentUser();
  const { user: clerkUser } = useUser();
  const { data: users, error, mutate } = useSWR<User[]>('/api/users', fetcher);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el rol');
      }
      const updatedUser = await response.json();
      mutate(users?.map((u) => (u.id === userId ? updatedUser : u)), false);
      toast.success(`Rol actualizado a ${ROLE_LABELS[newRole]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el rol');
      mutate();
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStatusToggle = async (userId: string, newStatus: boolean) => {
    setTogglingUserId(userId);
    try {
      const response = await fetch(`/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el estado');
      }
      const updatedUser = await response.json();
      mutate(users?.map((u) => (u.id === userId ? updatedUser : u)), false);
      toast.success(newStatus ? 'Usuario activado' : 'Usuario desactivado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar el estado');
      mutate();
    } finally {
      setTogglingUserId(null);
    }
  };

  if (!isLoaded || (!users && !error)) return <LoadingTable />;

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acceso denegado"
        description="Solo los administradores pueden gestionar usuarios."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Error al cargar usuarios"
        description="Hubo un problema al cargar los usuarios. Por favor, intenta de nuevo."
      />
    );
  }

  if (!users || users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No hay usuarios"
        description="No se encontraron usuarios en tu organización."
      />
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <InviteUserDialog />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Usuario</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden lg:table-cell">Fecha de registro</TableHead>
              <TableHead className="w-[80px]">Activo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isUpdating = updatingUserId === user.id;
              const isCurrentUser = clerkUser?.id === user.clerk_user_id;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
                        <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.full_name}</span>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs" aria-label="Tu usuario">Tú</Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground md:hidden">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm">{user.email}</span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => {
                        if (value === 'admin' || value === 'supervisor' || value === 'architect') {
                          handleRoleChange(user.id, value);
                        }
                      }}
                      disabled={isUpdating || isCurrentUser}
                      aria-busy={isUpdating}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue>
                          <Badge variant="secondary" className={ROLE_COLORS[user.role]}>
                            {ROLE_LABELS[user.role]}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <Badge variant="secondary" className={ROLE_COLORS.admin}>Admin</Badge>
                        </SelectItem>
                        <SelectItem value="supervisor">
                          <Badge variant="secondary" className={ROLE_COLORS.supervisor}>Supervisor</Badge>
                        </SelectItem>
                        <SelectItem value="architect">
                          <Badge variant="secondary" className={ROLE_COLORS.architect}>Arquitecto</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">{formatDate(user.created_at)}</span>
                  </TableCell>
                  <TableCell>
                    <Switch
                      aria-label={`${user.is_active ? 'Desactivar' : 'Activar'} a ${user.full_name}`}
                      checked={user.is_active}
                      onCheckedChange={(checked) => handleStatusToggle(user.id, checked)}
                      disabled={togglingUserId === user.id || isCurrentUser}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/users/page.tsx
git commit -m "feat: add /settings/users page with user management table"
```

---

### Task 8: Update sidebar — show /settings for all roles

**Files:**
- Modify: `apps/web/components/sidebar.tsx`
- Modify: `apps/web/components/mobile-nav.tsx` (if it exists, check for similar pattern)

**Context:** The sidebar currently filters out `/settings` for non-admin users with `item.href !== '/settings' || isAdmin`. Now all roles need to see `/settings` (the layout handles tab visibility per role). Check if `mobile-nav.tsx` has the same filter.

**Step 1: Update sidebar**

In `apps/web/components/sidebar.tsx`, remove the role filter. Change:

```typescript
const visibleNavItems = navItems.filter(
  (item) => item.href !== '/settings' || isAdmin
);
```

To:

```typescript
const visibleNavItems = navItems;
```

**Step 2: Check and update mobile-nav.tsx**

Look for `apps/web/components/mobile-nav.tsx`. If it has a similar filter removing `/settings` for non-admins, apply the same change.

**Step 3: Build to verify**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/web/components/sidebar.tsx apps/web/components/mobile-nav.tsx
git commit -m "feat: show /settings nav for all roles (layout handles tab visibility)"
```

---

### Task 9: Cost Center form dialog component

**Files:**
- Create: `apps/web/components/cost-center-form-dialog.tsx`

**Context:** Follow the exact same pattern as `apps/web/components/project-form-dialog.tsx`. Uses Dialog from shadcn, form state with useState, color picker with 8 colored circles, POST/PATCH to `/api/cost-centers`. `PROJECT_COLOR_HEX` from `@/lib/project-colors` for color rendering.

**Step 1: Create component**

File: `apps/web/components/cost-center-form-dialog.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { mutate } from 'swr';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
import type { CostCenter, ProjectColor } from '@architech/shared';

interface CostCenterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter?: CostCenter;
}

export function CostCenterFormDialog({ open, onOpenChange, costCenter }: CostCenterFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    color: ProjectColor | '';
  }>({ name: '', description: '', color: '' });

  useEffect(() => {
    if (costCenter) {
      setFormData({
        name: costCenter.name,
        description: costCenter.description ?? '',
        color: costCenter.color ?? '',
      });
    } else {
      setFormData({ name: '', description: '', color: '' });
    }
  }, [costCenter, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color || null,
      };

      const response = await fetch(
        costCenter ? `/api/cost-centers/${costCenter.id}` : '/api/cost-centers',
        {
          method: costCenter ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al guardar');
      }

      toast.success(costCenter ? 'Centro de costos actualizado' : 'Centro de costos creado');
      await mutate('/api/cost-centers');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{costCenter ? 'Editar Centro de Costos' : 'Nuevo Centro de Costos'}</DialogTitle>
          <DialogDescription>
            {costCenter ? 'Actualiza los datos del centro de costos' : 'Crea un nuevo centro de costos para clasificar comprobantes'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-name">Nombre <span className="text-red-500">*</span></Label>
            <Input
              id="cc-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Albañilería"
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-description">Descripción</Label>
            <Textarea
              id="cc-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción opcional del centro de costos"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Color (opcional)</Label>
            <div className="flex gap-2 flex-wrap">
              {(['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: formData.color === c ? '' : c })}
                  className={`h-8 w-8 rounded-full transition-all ${
                    formData.color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: PROJECT_COLOR_HEX[c] }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : costCenter ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify Textarea component exists**

Check if `@/components/ui/textarea` exists. If not, add it via: `npx shadcn@latest add textarea` (run from `apps/web/`).

**Step 3: Commit**

```bash
git add apps/web/components/cost-center-form-dialog.tsx
git commit -m "feat: add CostCenterFormDialog component"
```

---

### Task 10: Cost Centers page — /settings/cost-centers

**Files:**
- Create: `apps/web/app/(dashboard)/settings/cost-centers/page.tsx`

**Context:** Table-based CRUD page. Shows active cost centers with name, description, color dot, and action buttons. Uses `CostCenterFormDialog` for create/edit. Delete shows confirmation dialog (same pattern as receipt delete). Admin/supervisor only — but the layout already controls tab visibility, so this page just renders the content.

**Step 1: Create page**

File: `apps/web/app/(dashboard)/settings/cost-centers/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Layers, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetcher } from '@/lib/fetcher';
import { useCurrentUser } from '@/lib/use-current-user';
import { PROJECT_COLOR_HEX } from '@/lib/project-colors';
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
import { CostCenterFormDialog } from '@/components/cost-center-form-dialog';
import type { CostCenter } from '@architech/shared';

export default function CostCentersPage() {
  const { role } = useCurrentUser();
  const canManage = role === 'admin' || role === 'supervisor';
  const { data: costCenters, error } = useSWR<CostCenter[]>('/api/cost-centers', fetcher);

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | undefined>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (cc: CostCenter) => {
    setEditingCostCenter(cc);
    setShowFormDialog(true);
  };

  const handleCreate = () => {
    setEditingCostCenter(undefined);
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
      const response = await fetch(`/api/cost-centers/${deletingId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al eliminar');
      }
      toast.success('Centro de costos eliminado');
      await mutate('/api/cost-centers');
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar');
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  if (!costCenters && !error) return <LoadingTable />;

  if (error) {
    return (
      <EmptyState
        icon={Layers}
        title="Error al cargar centros de costos"
        description="Hubo un problema. Por favor, intenta de nuevo."
      />
    );
  }

  if (!costCenters || costCenters.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No hay centros de costos"
        description="Crea tu primer centro de costos para clasificar comprobantes."
        action={
          canManage ? (
            <Button onClick={handleCreate}>Crear centro de costos</Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      {canManage && (
        <div className="flex justify-end mb-4">
          <Button onClick={handleCreate}>Nuevo centro de costos</Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Color</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden md:table-cell">Descripción</TableHead>
              {canManage && <TableHead className="w-[100px]">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {costCenters.map((cc) => (
              <TableRow key={cc.id}>
                <TableCell>
                  {cc.color ? (
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: PROJECT_COLOR_HEX[cc.color] }}
                    />
                  ) : (
                    <span className="inline-block h-3 w-3 rounded-full bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{cc.name}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {cc.description || '—'}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(cc)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(cc.id)}>
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

      <CostCenterFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        costCenter={editingCostCenter}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Centro de Costos</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Los comprobantes asignados a este centro conservarán la referencia pero no se podrá seleccionar en nuevos comprobantes.
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

**Step 2: Build to verify**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/cost-centers/page.tsx
git commit -m "feat: add /settings/cost-centers page with CRUD UI"
```

---

### Task 11: Receipt review — add required cost center select

**Files:**
- Modify: `apps/web/components/receipt-review.tsx`

**Context:** The receipt review component is used when confirming a receipt after upload/extraction. We need to add a required Select for cost center, similar to the project Select. Cost centers are loaded from `/api/cost-centers`. The `handleConfirm` must include `cost_center_id` in the payload and validate it's set.

**Step 1: Add cost center state and data fetching**

After the existing `const { data: projects }` line, add:

```typescript
const { data: costCenters } = useSWR<CostCenter[]>('/api/cost-centers', fetcher);
```

Add `CostCenter` to the import from `@architech/shared`.

Add state after `projectId`:

```typescript
const [costCenterId, setCostCenterId] = useState('');
```

**Step 2: Add cost center Select in the UI**

After the Project select block (after `</Select>` closing for project, inside the same `CardContent`), add:

```tsx
{/* Cost Center */}
<div>
  <Label htmlFor="cost-center">Centro de Costos *</Label>
  <Select value={costCenterId} onValueChange={setCostCenterId}>
    <SelectTrigger id="cost-center" className="w-full mt-1">
      <SelectValue placeholder="Seleccionar centro de costos" />
    </SelectTrigger>
    <SelectContent>
      {costCenters?.map((cc) => (
        <SelectItem key={cc.id} value={cc.id}>
          <span className="flex items-center gap-2">
            {cc.color && (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: PROJECT_COLOR_HEX[cc.color] }}
              />
            )}
            {cc.name}
          </span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Step 3: Add validation and include in payload**

In `handleConfirm`, add validation after the `projectId` check:

```typescript
if (!costCenterId) { toast.error('Debes seleccionar un centro de costos'); return; }
```

In the payload construction, add after `project_id: projectId,`:

```typescript
cost_center_id: costCenterId,
```

**Step 4: Build to verify**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/web/components/receipt-review.tsx
git commit -m "feat: add required cost center select to receipt review"
```

---

### Task 12: Receipt detail — show and edit cost center

**Files:**
- Modify: `apps/web/app/(dashboard)/receipts/[id]/page.tsx`

**Context:** The receipt detail page shows info cards (project, uploader, amount, date). We need to add a cost center card. For receipts without a cost center (legacy), show a button to assign one. Admin/supervisor can edit. The `ReceiptDetail` type now includes `cost_center: { id, name, color } | null`. The page already imports `PROJECT_COLOR_HEX`. We need to add a PATCH call to update cost_center_id.

**Step 1: Add cost center imports and state**

Add to imports:
- `Layers` from lucide-react
- `CostCenter` from `@architech/shared`
- `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` (already imported)

Add state:

```typescript
const [showCostCenterEdit, setShowCostCenterEdit] = useState(false);
const [selectedCostCenterId, setSelectedCostCenterId] = useState('');
const [isSavingCostCenter, setIsSavingCostCenter] = useState(false);
```

Add SWR for cost centers:

```typescript
const { data: costCenters } = useSWR<CostCenter[]>('/api/cost-centers', fetcher);
```

**Step 2: Add cost center card in the info cards grid**

After the "Fecha del Comprobante" card, add:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-sm font-medium text-muted-foreground">
      <Layers className="inline mr-2 h-4 w-4" />
      Centro de Costos
    </CardTitle>
  </CardHeader>
  <CardContent>
    {receipt.cost_center ? (
      <div className="flex items-center gap-2">
        {receipt.cost_center.color && (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: PROJECT_COLOR_HEX[receipt.cost_center.color] }}
          />
        )}
        <span className="text-base font-medium">{receipt.cost_center.name}</span>
      </div>
    ) : (isAdmin || ctx.role === 'supervisor') ? (
      /* Show assignment UI for legacy receipts */
      /* Select + save button */
    ) : (
      <span className="text-muted-foreground">Sin asignar</span>
    )}
  </CardContent>
</Card>
```

For the assignment UI, use a Select with cost centers and a save button. The save handler calls `PATCH /api/receipts/{id}` with `{ cost_center_id }` and then mutates SWR.

Note: Use `useCurrentUser()` hook (already available via `isAdmin`) to check role. For supervisor check, use the existing pattern.

**Step 3: Add save handler**

```typescript
const handleSaveCostCenter = async () => {
  if (!selectedCostCenterId) return;
  setIsSavingCostCenter(true);
  try {
    const response = await fetch(`/api/receipts/${receiptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_center_id: selectedCostCenterId }),
    });
    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(errorBody.error ?? 'Error al asignar centro de costos');
    }
    toast.success('Centro de costos asignado');
    await mutate(`/api/receipts/${receiptId}`);
    setShowCostCenterEdit(false);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Error al asignar');
  } finally {
    setIsSavingCostCenter(false);
  }
};
```

**Step 4: Build to verify**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/receipts/\[id\]/page.tsx
git commit -m "feat: show cost center in receipt detail with edit for legacy receipts"
```

---

### Task 13: Receipts table — cost center column

**Files:**
- Modify: `apps/web/app/(dashboard)/receipts/page.tsx`

**Context:** The receipts table currently shows: Proveedor, Proyecto (colored badge), Monto, Fecha, Estado. We need to add a "Centro de Costos" column with a colored badge (same style as Proyecto). The `ReceiptWithDetails` type now includes `cost_center`. Import `PROJECT_BADGE_STYLES` from `@/lib/project-colors` (same pattern used for project badge).

**Step 1: Add cost center column header**

In the `<TableHeader>`, add after the "Proyecto" `<TableHead>`:

```tsx
<TableHead className="hidden lg:table-cell">Centro de Costos</TableHead>
```

**Step 2: Add cost center cell in each row**

After the Proyecto `<TableCell>`, add:

```tsx
<TableCell className="hidden lg:table-cell">
  {receipt.cost_center ? (
    <Badge
      variant="secondary"
      style={
        receipt.cost_center.color
          ? {
              backgroundColor: PROJECT_BADGE_STYLES[receipt.cost_center.color].bg,
              color: PROJECT_BADGE_STYLES[receipt.cost_center.color].text,
            }
          : undefined
      }
    >
      {receipt.cost_center.name}
    </Badge>
  ) : (
    <span className="text-muted-foreground">—</span>
  )}
</TableCell>
```

Make sure `PROJECT_BADGE_STYLES` is imported from `@/lib/project-colors`.

**Step 3: Build to verify**

Run: `npx turbo build --filter=web`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/receipts/page.tsx
git commit -m "feat: add cost center column to receipts table"
```

---

## Task Dependency Summary

```
Task 1 (migration) ──────┐
Task 2 (shared types) ───┤
                          ├── Task 3 (cost centers API)
                          ├── Task 4 (receipts API updates)
                          │
Task 5 (settings layout) ─┤
Task 6 (general page) ────┤── Can run after Task 5
Task 7 (users page) ──────┤
Task 8 (sidebar update) ──┘
                          │
Task 9 (form dialog) ─────┤── Needs Task 3
Task 10 (CC page) ────────┤── Needs Task 9
                          │
Task 11 (receipt review) ─┤── Needs Tasks 3, 4
Task 12 (receipt detail) ─┤── Needs Task 4
Task 13 (receipts table) ─┘── Needs Task 4
```

**Parallel groups:**
- Tasks 1-2: Run sequentially (types depend on knowing schema)
- Tasks 3-4: Can run in parallel after 1-2
- Tasks 5-8: Can run in parallel (independent of backend, after settings/page.tsx is freed)
- Tasks 9-10: Sequential (10 depends on 9)
- Tasks 11-13: Can run in parallel after API tasks
