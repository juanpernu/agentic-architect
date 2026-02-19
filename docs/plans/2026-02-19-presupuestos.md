# Presupuestos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add versioned project budgets to ObraLink — each project has one budget with immutable snapshots on every save, sections mapped to cost centers, and line items per section.

**Architecture:** Snapshot-based versioning with JSONB. Two DB tables (`budgets` + `budget_versions`). RESTful API following existing patterns. Client pages with SWR, inline editing, and accordion sections.

**Tech Stack:** Supabase (Postgres), Next.js App Router, SWR, shadcn/ui, Zod, Recharts (not needed yet), sileo (toasts)

---

### Task 1: Database Migration

**Files:**
- Create: `packages/db/migrations/007_budgets.sql`

**Step 1: Write the migration**

```sql
-- Budgets table (one per project)
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  current_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT budgets_project_id_unique UNIQUE (project_id)
);

CREATE INDEX idx_budgets_org_id ON budgets(organization_id);
CREATE INDEX idx_budgets_project_id ON budgets(project_id);

CREATE TRIGGER set_updated_at_budgets
  BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view budgets"
  ON budgets FOR SELECT
  USING (organization_id = public.get_org_id());

CREATE POLICY "Admin and supervisor can insert budgets"
  ON budgets FOR INSERT
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

CREATE POLICY "Admin and supervisor can update budgets"
  ON budgets FOR UPDATE
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'supervisor')
  );

-- Budget versions table (immutable snapshots)
CREATE TABLE budget_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  snapshot JSONB NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT budget_versions_budget_version_unique UNIQUE (budget_id, version_number)
);

CREATE INDEX idx_budget_versions_budget_id ON budget_versions(budget_id);

-- RLS for budget_versions
ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view budget versions"
  ON budget_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_versions.budget_id
      AND budgets.organization_id = public.get_org_id()
    )
  );

CREATE POLICY "Admin and supervisor can insert budget versions"
  ON budget_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_versions.budget_id
      AND budgets.organization_id = public.get_org_id()
    )
    AND public.get_user_role() IN ('admin', 'supervisor')
  );
```

**Step 2: Apply migration to Supabase**

Run the SQL in the Supabase dashboard or via CLI. Verify tables exist.

**Step 3: Commit**

```bash
git add packages/db/migrations/007_budgets.sql
git commit -m "feat: add budgets and budget_versions tables"
```

---

### Task 2: Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts` (append at end)
- Modify: `packages/shared/src/enums.ts` (no changes needed — no new enum)

**Step 1: Add budget types to `packages/shared/src/types.ts`**

Append after the `CostCenterSpend` interface:

```typescript
// Budget types
export interface BudgetItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

export interface BudgetSection {
  cost_center_id: string;
  cost_center_name: string;
  subtotal: number;
  items: BudgetItem[];
}

export interface BudgetSnapshot {
  sections: BudgetSection[];
}

export interface Budget {
  id: string;
  project_id: string;
  organization_id: string;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetVersion {
  id: string;
  budget_id: string;
  version_number: number;
  snapshot: BudgetSnapshot;
  total_amount: number;
  created_by: string;
  created_at: string;
}

export interface CreateBudgetInput {
  project_id: string;
  snapshot: BudgetSnapshot;
}

export interface UpdateBudgetInput {
  snapshot: BudgetSnapshot;
}
```

**Step 2: Add frontend API types to `apps/web/lib/api-types.ts`**

Append after the `ReceiptDetail` interface:

```typescript
import type { Budget, BudgetVersion, BudgetSnapshot } from '@architech/shared';

export interface BudgetListItem extends Budget {
  project_name: string;
  total_amount: number;
}

export interface BudgetDetail extends Budget {
  project: {
    id: string;
    name: string;
  };
  latest_version: BudgetVersion;
}

export interface BudgetVersionSummary {
  id: string;
  version_number: number;
  total_amount: number;
  created_by_name: string;
  created_at: string;
}
```

Note: Add the `Budget, BudgetVersion, BudgetSnapshot` imports to the existing import from `@architech/shared` at the top of `api-types.ts`.

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts apps/web/lib/api-types.ts
git commit -m "feat: add budget shared types and API types"
```

---

### Task 3: Zod Schema for Budget

**Files:**
- Create: `apps/web/lib/schemas/budget.ts`
- Modify: `apps/web/lib/schemas/index.ts` (add export)

**Step 1: Create budget schema**

```typescript
import { z } from 'zod';

export const budgetItemSchema = z.object({
  description: z.string().min(1, 'La descripción es requerida'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unit: z.string().min(1, 'La unidad es requerida'),
  unit_price: z.number().min(0, 'El precio unitario debe ser mayor o igual a 0'),
  subtotal: z.number(),
});

export const budgetSectionSchema = z.object({
  cost_center_id: z.string().uuid(),
  cost_center_name: z.string(),
  subtotal: z.number(),
  items: z.array(budgetItemSchema).min(1, 'Cada rubro debe tener al menos un ítem'),
});

export const budgetSnapshotSchema = z.object({
  sections: z.array(budgetSectionSchema).min(1, 'El presupuesto debe tener al menos un rubro'),
});

export type BudgetSnapshotFormData = z.infer<typeof budgetSnapshotSchema>;
```

**Step 2: Add export to `apps/web/lib/schemas/index.ts`**

Add this line:

```typescript
export { budgetSnapshotSchema, budgetItemSchema, budgetSectionSchema, type BudgetSnapshotFormData } from './budget';
```

**Step 3: Commit**

```bash
git add apps/web/lib/schemas/budget.ts apps/web/lib/schemas/index.ts
git commit -m "feat: add budget Zod validation schemas"
```

---

### Task 4: API — GET /api/budgets (list) + POST /api/budgets (create)

**Files:**
- Create: `apps/web/app/api/budgets/route.ts`

**Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const projectId = req.nextUrl.searchParams.get('project_id');

  let query = db
    .from('budgets')
    .select(`
      *,
      project:projects!project_id(id, name),
      latest_version:budget_versions(total_amount)
    `)
    .eq('organization_id', ctx.orgId)
    .order('updated_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const budgets = (data ?? []).map(({ latest_version, project, ...b }) => {
    // latest_version is an array of all versions' total_amount — get the last one
    const versions = latest_version as Array<{ total_amount: number }> | null;
    return {
      ...b,
      project_name: (project as { id: string; name: string })?.name ?? '',
      total_amount: versions?.length ? Number(versions[versions.length - 1].total_amount) : 0,
    };
  });

  return NextResponse.json(budgets);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const projectId = body.project_id as string;
  const snapshot = body.snapshot as Record<string, unknown>;

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }
  if (!snapshot) {
    return NextResponse.json({ error: 'snapshot is required' }, { status: 400 });
  }

  const db = getDb();

  // Verify project exists and belongs to org
  const { data: project } = await db
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Check project doesn't already have a budget
  const { data: existing } = await db
    .from('budgets')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Project already has a budget' }, { status: 409 });
  }

  // Calculate total
  const sections = (snapshot as { sections?: Array<{ subtotal?: number }> }).sections ?? [];
  const totalAmount = sections.reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0);

  // Create budget
  const { data: budget, error: budgetError } = await db
    .from('budgets')
    .insert({
      project_id: projectId,
      organization_id: ctx.orgId,
      current_version: 1,
    })
    .select()
    .single();

  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });

  // Create first version
  const { error: versionError } = await db
    .from('budget_versions')
    .insert({
      budget_id: budget.id,
      version_number: 1,
      snapshot,
      total_amount: totalAmount,
      created_by: ctx.dbUserId,
    });

  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });

  return NextResponse.json(budget, { status: 201 });
}
```

**Step 2: Commit**

```bash
git add apps/web/app/api/budgets/route.ts
git commit -m "feat: add GET and POST /api/budgets endpoints"
```

---

### Task 5: API — GET/PUT /api/budgets/[id]

**Files:**
- Create: `apps/web/app/api/budgets/[id]/route.ts`

**Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const db = getDb();
  const versionParam = req.nextUrl.searchParams.get('version');

  // Get budget with project info
  const { data: budget, error } = await db
    .from('budgets')
    .select('*, project:projects!project_id(id, name)')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (error || !budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get specific version or latest
  let versionQuery = db
    .from('budget_versions')
    .select('*')
    .eq('budget_id', id);

  if (versionParam) {
    versionQuery = versionQuery.eq('version_number', parseInt(versionParam, 10));
  } else {
    versionQuery = versionQuery.eq('version_number', budget.current_version);
  }

  const { data: version } = await versionQuery.single();

  return NextResponse.json({
    ...budget,
    latest_version: version,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const snapshot = body.snapshot;
  if (!snapshot) {
    return NextResponse.json({ error: 'snapshot is required' }, { status: 400 });
  }

  const db = getDb();

  // Verify budget exists and belongs to org
  const { data: budget } = await db
    .from('budgets')
    .select('id, current_version')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newVersion = budget.current_version + 1;

  // Calculate total
  const sections = (snapshot as { sections?: Array<{ subtotal?: number }> }).sections ?? [];
  const totalAmount = sections.reduce((sum, s) => sum + (Number(s.subtotal) || 0), 0);

  // Create new version
  const { error: versionError } = await db
    .from('budget_versions')
    .insert({
      budget_id: id,
      version_number: newVersion,
      snapshot,
      total_amount: totalAmount,
      created_by: ctx.dbUserId,
    });

  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });

  // Update current version
  const { error: updateError } = await db
    .from('budgets')
    .update({ current_version: newVersion })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ version_number: newVersion, total_amount: totalAmount });
}
```

**Step 2: Commit**

```bash
git add apps/web/app/api/budgets/[id]/route.ts
git commit -m "feat: add GET and PUT /api/budgets/:id endpoints"
```

---

### Task 6: API — GET /api/budgets/[id]/versions

**Files:**
- Create: `apps/web/app/api/budgets/[id]/versions/route.ts`

**Step 1: Write the API route**

```typescript
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const db = getDb();

  // Verify budget belongs to org
  const { data: budget } = await db
    .from('budgets')
    .select('id')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await db
    .from('budget_versions')
    .select('id, version_number, total_amount, created_at, created_by:users!created_by(full_name)')
    .eq('budget_id', id)
    .order('version_number', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const versions = (data ?? []).map(({ created_by, ...v }) => ({
    ...v,
    created_by_name: (created_by as { full_name: string } | null)?.full_name ?? 'Usuario',
  }));

  return NextResponse.json(versions);
}
```

**Step 2: Commit**

```bash
git add apps/web/app/api/budgets/[id]/versions/route.ts
git commit -m "feat: add GET /api/budgets/:id/versions endpoint"
```

---

### Task 7: Navigation — Sidebar + Bottom Nav

**Files:**
- Modify: `apps/web/components/sidebar.tsx`
- Modify: `apps/web/components/bottom-nav.tsx`

**Step 1: Add Presupuestos to sidebar**

In `apps/web/components/sidebar.tsx`, add `Calculator` to the lucide-react import and add the nav item after the `Cargar` entry:

```typescript
// Add to imports:
import { LayoutDashboard, FolderKanban, Receipt, Upload, Calculator, BarChart3, Settings } from 'lucide-react';

// Add to navItems array, after the Upload entry and before Reportes:
  { href: '/budgets', label: 'Presupuestos', icon: Calculator },
```

**Step 2: Add Presupuestos to bottom nav (optional)**

In `apps/web/components/bottom-nav.tsx`, add `Calculator` to imports and add the item after Proyectos:

```typescript
// Add to imports:
import { LayoutDashboard, FolderKanban, Upload, Calculator, Settings } from 'lucide-react';

// Add to navItems array, after Proyectos:
  { href: '/budgets', label: 'Presupuestos', icon: Calculator },
```

**Step 3: Commit**

```bash
git add apps/web/components/sidebar.tsx apps/web/components/bottom-nav.tsx
git commit -m "feat: add Presupuestos to sidebar and bottom nav"
```

---

### Task 8: Budget List Page

**Files:**
- Create: `apps/web/app/(dashboard)/budgets/page.tsx`

**Step 1: Write the budget list page**

Follow the same pattern as `projects/page.tsx`. Use `useSWR` to fetch `/api/budgets`, display in a table with columns: Proyecto, Versión, Total, Última actualización. Include search by project name and a "Nuevo Presupuesto" button for admin/supervisor.

```tsx
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Calculator, Plus, Search } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import type { BudgetListItem } from '@/lib/api-types';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreateBudgetDialog } from '@/components/create-budget-dialog';

export default function BudgetsPage() {
  const { isAdminOrSupervisor } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: budgets, isLoading, error } = useSWR<BudgetListItem[]>(
    '/api/budgets',
    fetcher
  );

  const filteredBudgets = budgets?.filter((b) =>
    b.project_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Presupuestos" />
        <div className="text-red-600">Error al cargar presupuestos</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Presupuestos"
        description="Presupuestos de obra por proyecto"
        action={
          isAdminOrSupervisor ? (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2" />
              Nuevo Presupuesto
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por proyecto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 max-w-md"
          aria-label="Buscar presupuestos"
        />
      </div>

      {isLoading && <LoadingTable />}

      {!isLoading && filteredBudgets?.length === 0 && (
        <EmptyState
          icon={Calculator}
          title="No hay presupuestos"
          description={
            searchQuery
              ? 'No se encontraron presupuestos con ese filtro'
              : 'Comienza creando un presupuesto para un proyecto'
          }
          action={
            !searchQuery && isAdminOrSupervisor ? (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2" />
                Crear Presupuesto
              </Button>
            ) : undefined
          }
        />
      )}

      {!isLoading && filteredBudgets && filteredBudgets.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Versión</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Última actualización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBudgets.map((budget) => (
                <TableRow key={budget.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/budgets/${budget.id}`} className="font-medium hover:underline">
                      {budget.project_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">v{budget.current_version}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(budget.total_amount)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(budget.updated_at).toLocaleDateString('es-AR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateBudgetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/budgets/page.tsx
git commit -m "feat: add budget list page at /budgets"
```

---

### Task 9: Create Budget Dialog

**Files:**
- Create: `apps/web/components/create-budget-dialog.tsx`

**Step 1: Write the dialog component**

This dialog lets the user pick a project (only projects without a budget) and creates an empty budget with one section.

```tsx
'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import { fetcher } from '@/lib/fetcher';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Project, CostCenter, BudgetSnapshot } from '@architech/shared';
import type { BudgetListItem } from '@/lib/api-types';

interface CreateBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBudgetDialog({ open, onOpenChange }: CreateBudgetDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const { data: projects = [] } = useSWR<Project[]>(open ? '/api/projects' : null, fetcher);
  const { data: budgets = [] } = useSWR<BudgetListItem[]>(open ? '/api/budgets' : null, fetcher);
  const { data: costCenters = [] } = useSWR<CostCenter[]>(open ? '/api/cost-centers' : null, fetcher);

  // Filter out projects that already have a budget
  const projectsWithBudget = new Set(budgets.map((b) => b.project_id));
  const availableProjects = projects.filter((p) => !projectsWithBudget.has(p.id));

  useEffect(() => {
    setSelectedProjectId('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setIsSubmitting(true);

    try {
      // Create initial snapshot with one empty section if cost centers exist
      const initialSnapshot: BudgetSnapshot = {
        sections: costCenters.length > 0
          ? [{
              cost_center_id: costCenters[0].id,
              cost_center_name: costCenters[0].name,
              subtotal: 0,
              items: [{ description: '', quantity: 1, unit: 'unidad', unit_price: 0, subtotal: 0 }],
            }]
          : [],
      };

      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProjectId, snapshot: initialSnapshot }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al crear presupuesto');
      }

      const budget = await response.json();

      sileo.success({ title: 'Presupuesto creado' });
      await mutate('/api/budgets');
      onOpenChange(false);
      router.push(`/budgets/${budget.id}`);
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al crear presupuesto' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Presupuesto</DialogTitle>
          <DialogDescription>Selecciona el proyecto para crear su presupuesto</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="project">Proyecto <span className="text-red-500">*</span></FieldLabel>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="project" className="w-full">
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableProjects.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Todos los proyectos ya tienen presupuesto
              </p>
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedProjectId}>
              {isSubmitting ? 'Creando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/create-budget-dialog.tsx
git commit -m "feat: add CreateBudgetDialog component"
```

---

### Task 10: Budget Editor Page

**Files:**
- Create: `apps/web/app/(dashboard)/budgets/[id]/page.tsx`
- Create: `apps/web/components/budget-editor.tsx`
- Create: `apps/web/components/budget-section-card.tsx`
- Create: `apps/web/components/save-budget-dialog.tsx`

This is the largest task. It contains the editor page, section accordion, item rows, and save confirmation dialog.

**Step 1: Create `save-budget-dialog.tsx`**

Simple confirmation dialog shown before saving a new version.

```tsx
'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SaveBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSaving: boolean;
}

export function SaveBudgetDialog({ open, onOpenChange, onConfirm, isSaving }: SaveBudgetDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Guardar presupuesto</AlertDialogTitle>
          <AlertDialogDescription>
            Una vez guardado, esta versión no se puede modificar. ¿Querés guardar el presupuesto?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar versión'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Create `budget-section-card.tsx`**

Accordion card for one rubro/cost center with its items table.

```tsx
'use client';

import { Trash2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import type { BudgetSection, BudgetItem } from '@architech/shared';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface BudgetSectionCardProps {
  section: BudgetSection;
  onUpdate: (section: BudgetSection) => void;
  onRemove: () => void;
  readOnly: boolean;
}

export function BudgetSectionCard({ section, onUpdate, onRemove, readOnly }: BudgetSectionCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  const updateItem = (index: number, field: keyof BudgetItem, value: string | number) => {
    const items = [...section.items];
    const item = { ...items[index], [field]: value };
    // Recalculate subtotal
    item.subtotal = Number(item.quantity) * Number(item.unit_price);
    items[index] = item;
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    onUpdate({ ...section, items, subtotal });
  };

  const addItem = () => {
    const items = [...section.items, { description: '', quantity: 1, unit: 'unidad', unit_price: 0, subtotal: 0 }];
    onUpdate({ ...section, items });
  };

  const removeItem = (index: number) => {
    const items = section.items.filter((_, i) => i !== index);
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    onUpdate({ ...section, items, subtotal });
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                {section.cost_center_name}
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{formatCurrency(section.subtotal)}</span>
                {!readOnly && (
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="h-8 w-8">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Descripción</TableHead>
                  <TableHead className="w-[12%]">Cantidad</TableHead>
                  <TableHead className="w-[12%]">Unidad</TableHead>
                  <TableHead className="w-[15%] text-right">Precio Unit.</TableHead>
                  <TableHead className="w-[15%] text-right">Subtotal</TableHead>
                  {!readOnly && <TableHead className="w-[6%]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Descripción del ítem"
                        disabled={readOnly}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        disabled={readOnly}
                        className="h-8"
                        min={0}
                        step="any"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        placeholder="unidad"
                        disabled={readOnly}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        disabled={readOnly}
                        className="h-8 text-right"
                        min={0}
                        step="any"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.subtotal)}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8">
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!readOnly && (
              <Button variant="ghost" size="sm" onClick={addItem} className="mt-2">
                <Plus className="mr-1 h-3 w-3" />
                Agregar ítem
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
```

**Step 3: Create `budget-editor.tsx`**

Main editor component that manages state, sections, and save logic.

```tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { sileo } from 'sileo';
import { Plus, Save } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { useCurrentUser } from '@/lib/use-current-user';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BudgetSectionCard } from '@/components/budget-section-card';
import { SaveBudgetDialog } from '@/components/save-budget-dialog';
import type { BudgetSnapshot, BudgetSection, CostCenter } from '@architech/shared';
import type { BudgetDetail } from '@/lib/api-types';

interface BudgetEditorProps {
  budget: BudgetDetail;
  readOnly?: boolean;
}

export function BudgetEditor({ budget, readOnly: forceReadOnly }: BudgetEditorProps) {
  const { isAdminOrSupervisor } = useCurrentUser();
  const readOnly = forceReadOnly || !isAdminOrSupervisor;

  const { data: costCenters = [] } = useSWR<CostCenter[]>('/api/cost-centers', fetcher);

  const [sections, setSections] = useState<BudgetSection[]>(
    budget.latest_version?.snapshot?.sections ?? []
  );
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset sections when budget changes (e.g., version switch)
  useEffect(() => {
    setSections(budget.latest_version?.snapshot?.sections ?? []);
    setIsDirty(false);
  }, [budget.latest_version?.version_number]);

  const totalAmount = sections.reduce((sum, s) => sum + s.subtotal, 0);

  const updateSection = useCallback((index: number, section: BudgetSection) => {
    setSections((prev) => {
      const next = [...prev];
      next[index] = section;
      return next;
    });
    setIsDirty(true);
  }, []);

  const removeSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

  const addSection = useCallback((costCenterId: string) => {
    const cc = costCenters.find((c) => c.id === costCenterId);
    if (!cc) return;
    setSections((prev) => [
      ...prev,
      {
        cost_center_id: cc.id,
        cost_center_name: cc.name,
        subtotal: 0,
        items: [{ description: '', quantity: 1, unit: 'unidad', unit_price: 0, subtotal: 0 }],
      },
    ]);
    setIsDirty(true);
  }, [costCenters]);

  // Cost centers not yet used in the budget
  const usedCostCenterIds = new Set(sections.map((s) => s.cost_center_id));
  const availableCostCenters = costCenters.filter((c) => c.is_active && !usedCostCenterIds.has(c.id));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const snapshot: BudgetSnapshot = { sections };
      const response = await fetch(`/api/budgets/${budget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error ?? 'Error al guardar');
      }

      const result = await response.json();
      sileo.success({ title: `Versión ${result.version_number} guardada` });
      setIsDirty(false);
      setShowSaveDialog(false);
      await mutate(`/api/budgets/${budget.id}`);
      await mutate('/api/budgets');
    } catch (error) {
      sileo.error({ title: error instanceof Error ? error.message : 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{(budget.project as { name: string })?.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">v{budget.current_version}</Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-lg font-semibold">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
        {!readOnly && (
          <Button onClick={() => setShowSaveDialog(true)} disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            Guardar
          </Button>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, index) => (
          <BudgetSectionCard
            key={`${section.cost_center_id}-${index}`}
            section={section}
            onUpdate={(s) => updateSection(index, s)}
            onRemove={() => removeSection(index)}
            readOnly={readOnly}
          />
        ))}
      </div>

      {/* Add section */}
      {!readOnly && availableCostCenters.length > 0 && (
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Select onValueChange={addSection}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Agregar rubro..." />
            </SelectTrigger>
            <SelectContent>
              {availableCostCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Total */}
      <div className="flex justify-end border-t pt-4">
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Total del presupuesto</div>
          <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      <SaveBudgetDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onConfirm={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}
```

**Step 4: Create the page at `apps/web/app/(dashboard)/budgets/[id]/page.tsx`**

```tsx
'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { LoadingCards } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { BudgetEditor } from '@/components/budget-editor';
import type { BudgetDetail } from '@/lib/api-types';

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: budget, isLoading, error } = useSWR<BudgetDetail>(
    `/api/budgets/${id}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingCards count={3} />
      </div>
    );
  }

  if (error || !budget) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error al cargar el presupuesto</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/budgets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/budgets/${id}/history`}>
          <Button variant="outline" size="sm">
            <History className="mr-2 h-4 w-4" />
            Historial
          </Button>
        </Link>
      </div>
      <BudgetEditor budget={budget} />
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add apps/web/components/save-budget-dialog.tsx apps/web/components/budget-section-card.tsx apps/web/components/budget-editor.tsx apps/web/app/\(dashboard\)/budgets/\[id\]/page.tsx
git commit -m "feat: add budget editor page with sections, items, and save confirmation"
```

---

### Task 11: Version History Page

**Files:**
- Create: `apps/web/app/(dashboard)/budgets/[id]/history/page.tsx`

**Step 1: Write the history page**

```tsx
'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { BudgetVersionSummary, BudgetDetail } from '@/lib/api-types';

export default function BudgetHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: budget } = useSWR<BudgetDetail>(`/api/budgets/${id}`, fetcher);
  const { data: versions, isLoading } = useSWR<BudgetVersionSummary[]>(
    `/api/budgets/${id}/versions`,
    fetcher
  );

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/budgets/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Historial de versiones</h1>
          {budget && (
            <p className="text-muted-foreground">{(budget.project as { name: string })?.name}</p>
          )}
        </div>
      </div>

      {isLoading && <LoadingTable />}

      {!isLoading && versions && versions.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versión</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Guardado por</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link
                      href={`/budgets/${id}?version=${v.version_number}`}
                      className="hover:underline"
                    >
                      <Badge variant={v.version_number === budget?.current_version ? 'default' : 'secondary'}>
                        v{v.version_number}
                      </Badge>
                      {v.version_number === budget?.current_version && (
                        <span className="ml-2 text-xs text-muted-foreground">actual</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(v.total_amount)}</TableCell>
                  <TableCell>{v.created_by_name}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(v.created_at).toLocaleString('es-AR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/budgets/\[id\]/history/page.tsx
git commit -m "feat: add budget version history page"
```

---

### Task 12: Project Detail — Link to Budget

**Files:**
- Modify: `apps/web/app/(dashboard)/projects/[id]/page.tsx`

**Step 1: Explore existing project detail page**

Read the file first to understand how it's structured. Then add a section/button that links to the project's budget if it exists, or shows a "Crear presupuesto" button if it doesn't.

The changes should:
- Fetch budget for this project: `useSWR<BudgetListItem[]>('/api/budgets?project_id=${id}', fetcher)`
- If budget exists: show a link "Ver presupuesto" → `/budgets/${budget.id}`
- If no budget and user is admin/supervisor: show "Crear presupuesto" button that opens `CreateBudgetDialog` or navigates to create flow

**Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/projects/\[id\]/page.tsx
git commit -m "feat: add budget link in project detail page"
```

---

### Task 13: Verify AlertDialog Component Exists

**Files:**
- Check: `apps/web/components/ui/alert-dialog.tsx`

**Step 1: Verify the shadcn AlertDialog component exists**

The `SaveBudgetDialog` uses `AlertDialog` from shadcn/ui. Check if `apps/web/components/ui/alert-dialog.tsx` exists. If not, install it:

```bash
npx shadcn@latest add alert-dialog
```

**Step 2: Verify the Collapsible component exists**

The `BudgetSectionCard` uses `Collapsible` from shadcn/ui. Check if `apps/web/components/ui/collapsible.tsx` exists. If not, install it:

```bash
npx shadcn@latest add collapsible
```

**Step 3: Commit if new files were added**

```bash
git add apps/web/components/ui/alert-dialog.tsx apps/web/components/ui/collapsible.tsx
git commit -m "feat: add alert-dialog and collapsible shadcn components"
```

---

### Task 14: Final Integration Test

**Step 1: Run the dev server**

```bash
cd /Users/juanpernu/Workspace/agentic-architect/.worktrees/presupuestos
npm run dev
```

**Step 2: Manual verification checklist**

- [ ] Navigate to `/budgets` — empty state shows
- [ ] Click "Nuevo Presupuesto" — dialog shows available projects
- [ ] Create a budget — redirects to editor
- [ ] Add rubros (cost centers) and items
- [ ] Verify subtotals calculate correctly
- [ ] Click "Guardar" — confirmation dialog appears
- [ ] Confirm save — toast shows, version increments
- [ ] Navigate to history — versions listed
- [ ] Click old version — read-only view
- [ ] Check sidebar — "Presupuestos" link active
- [ ] Check project detail — budget link visible
- [ ] Test as architect role — editor is read-only

**Step 3: Final commit if any fixes needed**

---

### Summary

| Task | Description | Estimated complexity |
|------|-------------|---------------------|
| 1 | Database migration | Small |
| 2 | Shared types | Small |
| 3 | Zod schemas | Small |
| 4 | API: list + create | Medium |
| 5 | API: detail + update | Medium |
| 6 | API: version history | Small |
| 7 | Navigation | Small |
| 8 | Budget list page | Medium |
| 9 | Create budget dialog | Medium |
| 10 | Budget editor + components | Large |
| 11 | Version history page | Medium |
| 12 | Project detail link | Small |
| 13 | UI component dependencies | Small |
| 14 | Integration test | Manual |
