# Rubros & Budget Autosave Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor budget sections from org-level cost centers to budget-scoped rubros with inline creation, and implement a draft/publish workflow with autosave.

**Architecture:** Replace `cost_centers` table with `rubros` (budget-scoped). Add `status` + `snapshot` columns to `budgets` for draft/publish workflow. Budget editor becomes a state machine (draft ↔ published) with debounced autosave in draft mode. All `cost_center` references renamed to `rubro` across the full stack.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres), TypeScript, Zod, SWR, shadcn/ui

**Design doc:** `docs/plans/2026-02-20-rubros-autosave-design.md`

---

### Task 1: DB Migration — rubros table + budgets status/snapshot

The user has already created the `rubros` table and renamed `receipts.cost_center_id` → `receipts.rubro_id` with FK. This task adds the remaining DB changes.

**Files:**
- Manual: Run SQL in Supabase dashboard

**Step 1: Add status and snapshot columns to budgets**

Run in Supabase SQL editor:

```sql
-- Add status column (draft/published)
ALTER TABLE budgets
  ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published'));

-- Add snapshot column for live draft data
ALTER TABLE budgets
  ADD COLUMN snapshot JSONB;
```

**Step 2: Drop cost_centers table and related objects**

```sql
-- Drop the old table (already truncated)
DROP TABLE IF EXISTS cost_centers CASCADE;
```

**Step 3: Update RLS policies for rubros**

```sql
-- Enable RLS on rubros
ALTER TABLE rubros ENABLE ROW LEVEL SECURITY;

-- Read: org members can read rubros via budget → project → org chain
CREATE POLICY "org members can read rubros"
  ON rubros FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM budgets b
      JOIN projects p ON p.id = b.project_id
      WHERE b.id = rubros.budget_id
        AND p.organization_id = public.get_org_id()
    )
  );

-- Insert: admin/supervisor can create rubros
CREATE POLICY "admin/supervisor can create rubros"
  ON rubros FOR INSERT
  WITH CHECK (
    public.get_user_role() IN ('admin', 'supervisor')
    AND EXISTS (
      SELECT 1 FROM budgets b
      JOIN projects p ON p.id = b.project_id
      WHERE b.id = rubros.budget_id
        AND p.organization_id = public.get_org_id()
    )
  );

-- Update: admin/supervisor can update rubros
CREATE POLICY "admin/supervisor can update rubros"
  ON rubros FOR UPDATE
  USING (
    public.get_user_role() IN ('admin', 'supervisor')
    AND EXISTS (
      SELECT 1 FROM budgets b
      JOIN projects p ON p.id = b.project_id
      WHERE b.id = rubros.budget_id
        AND p.organization_id = public.get_org_id()
    )
  );

-- Delete: admin/supervisor can delete rubros
CREATE POLICY "admin/supervisor can delete rubros"
  ON rubros FOR DELETE
  USING (
    public.get_user_role() IN ('admin', 'supervisor')
    AND EXISTS (
      SELECT 1 FROM budgets b
      JOIN projects p ON p.id = b.project_id
      WHERE b.id = rubros.budget_id
        AND p.organization_id = public.get_org_id()
    )
  );
```

**Step 4: Verify**

Run: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'budgets' ORDER BY ordinal_position;`

Expected: `status` (text) and `snapshot` (jsonb) columns present.

---

### Task 2: Shared types — Replace CostCenter with Rubro

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Replace CostCenter interface with Rubro**

In `packages/shared/src/types.ts`, replace the `CostCenter` interface (lines 104-113):

```typescript
// DELETE this entire block:
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

// REPLACE with:
export interface Rubro {
  id: string;
  budget_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
}
```

**Step 2: Update BudgetSection**

Replace `BudgetSection` (lines 252-259):

```typescript
export interface BudgetSection {
  rubro_id: string;
  rubro_name: string;
  is_additional: boolean;
  subtotal?: number;
  cost?: number;
  items: BudgetItem[];
}
```

**Step 3: Update Budget interface**

Add `status` and `snapshot` to `Budget` (lines 265-272):

```typescript
export interface Budget {
  id: string;
  project_id: string;
  organization_id: string;
  current_version: number;
  status: 'draft' | 'published';
  snapshot: BudgetSnapshot | null;
  created_at: string;
  updated_at: string;
}
```

**Step 4: Update Receipt interface**

In `Receipt` (line 70), rename:

```typescript
// FROM:
cost_center_id: string | null;
// TO:
rubro_id: string | null;
```

**Step 5: Update ConfirmReceiptInput**

In `ConfirmReceiptInput` (line 188), rename:

```typescript
// FROM:
cost_center_id: string;
// TO:
rubro_id: string;
```

**Step 6: Replace CostCenterSpend with RubroSpend**

Replace `CostCenterSpend` (lines 235-241):

```typescript
export interface RubroSpend {
  project_id: string;
  project_name: string;
  rubro_id: string;
  rubro_name: string;
  rubro_color: string | null;
  total_amount: number;
  receipt_count: number;
}
```

**Step 7: Remove CostCenter from exports**

Ensure `CostCenter` is no longer exported. Search for any remaining `CostCenter` references and remove them.

**Step 8: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "refactor: replace CostCenter with Rubro in shared types"
```

---

### Task 3: Schemas — Replace cost center schemas with rubro

**Files:**
- Delete: `apps/web/lib/schemas/cost-center.ts`
- Create: `apps/web/lib/schemas/rubro.ts`
- Modify: `apps/web/lib/schemas/budget.ts`
- Modify: `apps/web/lib/schemas/index.ts`
- Modify: `apps/web/lib/schemas/receipt.ts` (if it references cost_center)

**Step 1: Create rubro schema**

Create `apps/web/lib/schemas/rubro.ts`:

```typescript
import { z } from 'zod';

export const rubroCreateSchema = z.object({
  budget_id: z.string().uuid(),
  name: z.string().min(1, 'El nombre es requerido').max(100).trim(),
  color: z.string().nullable().optional(),
});

export const rubroUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z.string().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export type RubroCreateInput = z.infer<typeof rubroCreateSchema>;
export type RubroUpdateInput = z.infer<typeof rubroUpdateSchema>;
```

**Step 2: Update budget schema**

In `apps/web/lib/schemas/budget.ts`, replace `cost_center_id`/`cost_center_name`:

```typescript
import { z } from 'zod';

export const budgetItemSchema = z.object({
  description: z.string(),
  unit: z.string(),
  quantity: z.number().min(0),
  cost: z.number().min(0),
  subtotal: z.number().min(0),
});

export const budgetSectionSchema = z.object({
  rubro_id: z.string().uuid(),
  rubro_name: z.string(),
  is_additional: z.boolean(),
  subtotal: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  items: z.array(budgetItemSchema),
});

export const budgetSnapshotSchema = z.object({
  sections: z.array(budgetSectionSchema),
});

export type BudgetSnapshotFormData = z.infer<typeof budgetSnapshotSchema>;
```

Note: `items` no longer requires `.min(1)` — a new section starts empty.

**Step 3: Update index.ts exports**

In `apps/web/lib/schemas/index.ts`, replace cost center exports:

```typescript
// REMOVE these lines:
export { costCenterSchema, costCenterCreateSchema, costCenterUpdateSchema } from './cost-center';
export type { CostCenterFormData, CostCenterCreateInput, CostCenterUpdateInput } from './cost-center';

// ADD:
export { rubroCreateSchema, rubroUpdateSchema } from './rubro';
export type { RubroCreateInput, RubroUpdateInput } from './rubro';
```

**Step 4: Delete old cost center schema**

Delete file: `apps/web/lib/schemas/cost-center.ts`

**Step 5: Update receipt schema if needed**

Search `apps/web/lib/schemas/receipt.ts` for `cost_center` and rename to `rubro`.

**Step 6: Commit**

```bash
git add apps/web/lib/schemas/
git commit -m "refactor: replace cost center schemas with rubro schemas"
```

---

### Task 4: API — Create `/api/rubros` endpoints

**Files:**
- Create: `apps/web/app/api/rubros/route.ts`
- Create: `apps/web/app/api/rubros/[id]/route.ts`

**Step 1: Create rubros list + create endpoint**

Create `apps/web/app/api/rubros/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { rubroCreateSchema } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const budgetId = req.nextUrl.searchParams.get('budget_id');

  if (budgetId) {
    // Rubros for a specific budget
    const { data, error } = await db
      .from('rubros')
      .select('*, budget:budgets!budget_id(id, project_id, organization_id)')
      .eq('budget_id', budgetId)
      .order('sort_order', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Verify org ownership
    const filtered = (data ?? []).filter(
      (r) => (r.budget as { organization_id: string })?.organization_id === ctx.orgId
    );

    return NextResponse.json(filtered.map(({ budget, ...r }) => r));
  }

  // All rubros for the org (for filters)
  const { data, error } = await db
    .from('rubros')
    .select('*, budget:budgets!budget_id(id, organization_id)')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtered = (data ?? []).filter(
    (r) => (r.budget as { organization_id: string })?.organization_id === ctx.orgId
  );

  return NextResponse.json(filtered.map(({ budget, ...r }) => r));
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

  const result = rubroCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const db = getDb();

  // Verify budget belongs to org
  const { data: budget } = await db
    .from('budgets')
    .select('id')
    .eq('id', result.data.budget_id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });

  // Get next sort_order
  const { data: existing } = await db
    .from('rubros')
    .select('sort_order')
    .eq('budget_id', result.data.budget_id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data: rubro, error } = await db
    .from('rubros')
    .insert({
      budget_id: result.data.budget_id,
      name: result.data.name,
      color: result.data.color ?? null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(rubro, { status: 201 });
}
```

**Step 2: Create rubros detail endpoint**

Create `apps/web/app/api/rubros/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { rubroUpdateSchema } from '@/lib/schemas';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const result = rubroUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const db = getDb();

  // Verify rubro belongs to org via budget
  const { data: rubro } = await db
    .from('rubros')
    .select('id, budget:budgets!budget_id(organization_id)')
    .eq('id', id)
    .single();

  if (!rubro || (rubro.budget as { organization_id: string })?.organization_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: updated, error } = await db
    .from('rubros')
    .update(result.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;
  const db = getDb();

  // Check if any receipts reference this rubro
  const { count } = await db
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('rubro_id', id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar un rubro con comprobantes asociados' },
      { status: 409 }
    );
  }

  const { error } = await db
    .from('rubros')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
```

**Step 3: Commit**

```bash
git add apps/web/app/api/rubros/
git commit -m "feat: add /api/rubros CRUD endpoints"
```

---

### Task 5: API — Update budgets endpoints for draft/publish

**Files:**
- Modify: `apps/web/app/api/budgets/route.ts`
- Modify: `apps/web/app/api/budgets/[id]/route.ts`

**Step 1: Update POST /api/budgets (create budget)**

In `apps/web/app/api/budgets/route.ts`, the POST handler should:
- Create budget with `status = 'draft'` and empty `snapshot`
- No longer require a snapshot or cost centers upfront
- No longer create an initial version (draft hasn't been published yet)

Replace the POST handler:

```typescript
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
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
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

  // Create budget as draft with empty snapshot
  const { data: budget, error: budgetError } = await db
    .from('budgets')
    .insert({
      project_id: projectId,
      organization_id: ctx.orgId,
      current_version: 0,
      status: 'draft',
      snapshot: { sections: [] },
    })
    .select()
    .single();

  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });

  return NextResponse.json(budget, { status: 201 });
}
```

**Step 2: Update GET /api/budgets/[id]**

The GET handler should return the live snapshot from the budget row (not from budget_versions) when viewing the current version. Only fetch from `budget_versions` when `?version=N` is specified for historical views.

Replace the GET handler in `apps/web/app/api/budgets/[id]/route.ts`:

```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const db = getDb();
  const versionParam = req.nextUrl.searchParams.get('version');

  const { data: budget, error } = await db
    .from('budgets')
    .select('*, project:projects!project_id(id, name)')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (error || !budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If requesting a specific historical version
  if (versionParam) {
    const { data: version } = await db
      .from('budget_versions')
      .select('*')
      .eq('budget_id', id)
      .eq('version_number', parseInt(versionParam, 10))
      .single();

    return NextResponse.json({
      ...budget,
      latest_version: version,
    });
  }

  // Return budget with live snapshot
  return NextResponse.json(budget);
}
```

**Step 3: Add PATCH /api/budgets/[id] for autosave + status changes**

Add a PATCH handler (new) to `apps/web/app/api/budgets/[id]/route.ts`:

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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = getDb();

  const { data: budget } = await db
    .from('budgets')
    .select('id, status')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Status change: published → draft (user clicked "Editar presupuesto")
  if (body.status === 'draft' && budget.status === 'published') {
    const { error } = await db
      .from('budgets')
      .update({ status: 'draft' })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: 'draft' });
  }

  // Autosave: update snapshot (only when draft)
  if (body.snapshot !== undefined) {
    if (budget.status !== 'draft') {
      return NextResponse.json({ error: 'Budget is published. Click "Editar presupuesto" first.' }, { status: 409 });
    }

    const { error } = await db
      .from('budgets')
      .update({ snapshot: body.snapshot })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ saved: true });
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
}
```

**Step 4: Rename PUT to POST /api/budgets/[id]/publish (Guardar versión)**

Replace the current PUT handler with the publish logic. The PUT handler becomes simpler — it takes the current snapshot from the budget row, creates a version, and sets status to published:

```typescript
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;
  const db = getDb();

  const { data: budget } = await db
    .from('budgets')
    .select('id, current_version, snapshot, status')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (budget.status !== 'draft') {
    return NextResponse.json({ error: 'Budget is not in draft mode' }, { status: 409 });
  }

  const snapshot = budget.snapshot as { sections?: Array<{ items?: Array<{ subtotal?: number }> }> };
  const sections = snapshot?.sections ?? [];
  const totalAmount = sections.reduce((sum, s) =>
    sum + (s.items ?? []).reduce((itemSum, i) => itemSum + (Number(i.subtotal) || 0), 0)
  , 0);

  const newVersion = budget.current_version + 1;

  // Create version snapshot
  const { error: versionError } = await db
    .from('budget_versions')
    .insert({
      budget_id: id,
      version_number: newVersion,
      snapshot: budget.snapshot,
      total_amount: totalAmount,
      created_by: ctx.dbUserId,
    });

  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });

  // Update budget status to published
  const { error: updateError } = await db
    .from('budgets')
    .update({ current_version: newVersion, status: 'published' })
    .eq('id', id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ version_number: newVersion, total_amount: totalAmount });
}
```

**Step 5: Commit**

```bash
git add apps/web/app/api/budgets/
git commit -m "feat: budget draft/publish workflow with autosave support"
```

---

### Task 6: API — Update receipts endpoints

**Files:**
- Modify: `apps/web/app/api/receipts/route.ts`

**Step 1: Update GET — rename cost_center join to rubro**

In the GET handler, replace the join:

```typescript
// FROM:
cost_center:cost_centers(id, name, color)
// TO:
rubro:rubros(id, name, color)
```

Also rename the filter param:

```typescript
// FROM:
const costCenterId = req.nextUrl.searchParams.get('cost_center_id');
// TO:
const rubroId = req.nextUrl.searchParams.get('rubro_id');
```

And the filter:

```typescript
if (rubroId) {
  query = query.eq('rubro_id', rubroId);
}
```

**Step 2: Update POST — rename cost_center_id to rubro_id**

In the POST handler:
- Replace `body.cost_center_id` with `body.rubro_id`
- Replace the cost_center validation query to check `rubros` table instead
- Remove the `is_active` check (rubros don't have is_active)
- The org ownership check goes through `rubros → budgets → projects → org`

**Step 3: Commit**

```bash
git add apps/web/app/api/receipts/
git commit -m "refactor: rename cost_center to rubro in receipts API"
```

---

### Task 7: API — Update reports endpoint

**Files:**
- Create: `apps/web/app/api/reports/by-rubro/route.ts`
- Delete: `apps/web/app/api/reports/by-cost-center/route.ts`

**Step 1: Create by-rubro report endpoint**

Create `apps/web/app/api/reports/by-rubro/route.ts` — similar to the old by-cost-center but grouped by project → rubro:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const projectId = req.nextUrl.searchParams.get('project_id');
  const dateFrom = req.nextUrl.searchParams.get('date_from');
  const dateTo = req.nextUrl.searchParams.get('date_to');

  let query = db
    .from('receipts')
    .select('id, total_amount, rubro_id, rubro:rubros(id, name, color), project:projects(id, name)')
    .eq('status', 'confirmed');

  // Filter by org (via project)
  query = query.eq('project.organization_id', ctx.orgId);

  if (projectId) query = query.eq('project_id', projectId);
  if (dateFrom) query = query.gte('receipt_date', dateFrom);
  if (dateTo) query = query.lte('receipt_date', dateTo);

  const { data: receipts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by project → rubro
  const map = new Map<string, {
    project_id: string;
    project_name: string;
    rubro_id: string;
    rubro_name: string;
    rubro_color: string | null;
    total_amount: number;
    receipt_count: number;
  }>();

  for (const r of receipts ?? []) {
    if (!r.rubro || !r.project) continue;
    const rubro = r.rubro as { id: string; name: string; color: string | null };
    const project = r.project as { id: string; name: string };
    const key = `${project.id}:${rubro.id}`;

    const existing = map.get(key);
    if (existing) {
      existing.total_amount += Number(r.total_amount);
      existing.receipt_count += 1;
    } else {
      map.set(key, {
        project_id: project.id,
        project_name: project.name,
        rubro_id: rubro.id,
        rubro_name: rubro.name,
        rubro_color: rubro.color,
        total_amount: Number(r.total_amount),
        receipt_count: 1,
      });
    }
  }

  const result = Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount);

  return NextResponse.json(result);
}
```

**Step 2: Delete old endpoint**

Delete directory: `apps/web/app/api/reports/by-cost-center/`

**Step 3: Commit**

```bash
git add apps/web/app/api/reports/
git commit -m "refactor: replace by-cost-center report with by-rubro (project hierarchy)"
```

---

### Task 8: Delete cost center files

**Files:**
- Delete: `apps/web/app/api/cost-centers/route.ts`
- Delete: `apps/web/app/api/cost-centers/[id]/route.ts`
- Delete: `apps/web/app/(dashboard)/settings/cost-centers/page.tsx`
- Delete: `apps/web/components/cost-center-form-dialog.tsx`
- Delete: `apps/web/lib/schemas/cost-center.ts`

**Step 1: Delete all cost center files**

```bash
rm -rf apps/web/app/api/cost-centers
rm -rf "apps/web/app/(dashboard)/settings/cost-centers"
rm apps/web/components/cost-center-form-dialog.tsx
rm apps/web/lib/schemas/cost-center.ts
```

**Step 2: Remove cost center tab from settings layout**

In `apps/web/app/(dashboard)/settings/layout.tsx`, remove line 12:

```typescript
// DELETE this line:
  { href: '/settings/cost-centers', label: 'Centro de Costos', roles: ['admin', 'supervisor'] },
```

**Step 3: Clean up project-colors.ts**

In `apps/web/lib/project-colors.ts`, remove `COST_CENTER_COLOR_HEX` and `COST_CENTER_BADGE_STYLES` objects entirely.

**Step 4: Update api-types.ts**

In `apps/web/lib/api-types.ts`:
- Remove `CostCenter` import
- Rename `cost_center` to `rubro` in `ReceiptWithDetails` and `ReceiptDetail`:

```typescript
// FROM:
cost_center: { id: string; name: string; color: ProjectColor | null } | null;
// TO:
rubro: { id: string; name: string; color: string | null } | null;
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove all cost center files and references"
```

---

### Task 9: Frontend — useAutosave hook

**Files:**
- Create: `apps/web/lib/use-autosave.ts`

**Step 1: Create the hook**

Create `apps/web/lib/use-autosave.ts`:

```typescript
import { useRef, useEffect, useState, useCallback } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 2000;
const SAVED_DISPLAY_MS = 3000;

export function useAutosave(
  budgetId: string,
  snapshot: unknown,
  enabled: boolean
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSnapshotRef = useRef<string>('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const save = useCallback(async (data: unknown) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/budgets/${budgetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: data }),
      });

      if (!isMountedRef.current) return;

      if (!res.ok) {
        setSaveStatus('error');
        return;
      }

      setSaveStatus('saved');
      // Reset to idle after a few seconds
      savedTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setSaveStatus('idle');
      }, SAVED_DISPLAY_MS);
    } catch {
      if (isMountedRef.current) setSaveStatus('error');
    }
  }, [budgetId]);

  useEffect(() => {
    if (!enabled) return;

    const serialized = JSON.stringify(snapshot);

    // Skip if nothing changed
    if (serialized === prevSnapshotRef.current) return;

    // Skip initial render
    if (prevSnapshotRef.current === '') {
      prevSnapshotRef.current = serialized;
      return;
    }

    prevSnapshotRef.current = serialized;

    // Clear existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    // Debounce save
    timerRef.current = setTimeout(() => {
      save(snapshot);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [snapshot, enabled, save]);

  const retry = useCallback(() => {
    save(snapshot);
  }, [save, snapshot]);

  return { saveStatus, retry };
}
```

**Step 2: Commit**

```bash
git add apps/web/lib/use-autosave.ts
git commit -m "feat: add useAutosave hook with debounce and status tracking"
```

---

### Task 10: Frontend — Rewrite BudgetTable for rubros + draft/publish

This is the largest task. The `budget-table.tsx` component needs significant changes:

**Files:**
- Modify: `apps/web/components/budget-table.tsx`

**Key changes:**
1. Remove `useSWR` for cost centers — sections are no longer tied to a dropdown
2. Section header: replace `<Select>` with editable `<Input>` for rubro name
3. Add "Agregar rubro" button that creates a new rubro via `POST /api/rubros` and adds an empty section
4. Integrate `useAutosave` hook
5. Replace "Guardar" button with "Guardar versión" (calls `PUT /api/budgets/:id`)
6. Add "Editar presupuesto" button when status is `published`
7. Add autosave status indicator in the header
8. Add banner when in draft mode: "Editando · Los cambios se guardan automáticamente"
9. Read snapshot from `budget.snapshot` instead of `budget.latest_version.snapshot`
10. Read-only mode when `budget.status === 'published'` (not just historical versions)

**Implementation notes:**
- The component receives `budget: BudgetDetail` as prop
- When `budget.status === 'published'` → show read-only with "Editar presupuesto" button
- When `budget.status === 'draft'` → show editable with autosave + "Guardar versión" button
- Creating a new rubro: POST to `/api/rubros`, get the ID back, add empty section to snapshot
- Renaming a rubro: PATCH to `/api/rubros/:id` + update `rubro_name` in snapshot
- Deleting a section: DELETE `/api/rubros/:id` + remove from snapshot

This task is large and should be implemented carefully. The engineer should:
1. First update the props/types to use the new `Budget` shape
2. Remove cost center fetching/dropdown logic
3. Add rubro inline editing
4. Add autosave integration
5. Add draft/publish UI

**Step 1: Commit**

```bash
git add apps/web/components/budget-table.tsx
git commit -m "feat: rewrite budget editor for rubros + draft/publish workflow"
```

---

### Task 11: Frontend — Update BudgetDetail page

**Files:**
- Modify: `apps/web/app/(dashboard)/budgets/[id]/page.tsx`

**Key changes:**
1. The page currently always passes `budget.latest_version.snapshot` to BudgetTable. Now:
   - For draft: use `budget.snapshot` directly
   - For historical version: use `budget_versions.snapshot` (via `?version=N`)
2. The `readOnly` prop logic changes:
   - Historical version → always read-only
   - `budget.status === 'published'` → read-only with "Editar presupuesto" button (handled inside BudgetTable)
   - `budget.status === 'draft'` → editable
3. SWR revalidation after publish/status change

**Step 1: Commit**

```bash
git add "apps/web/app/(dashboard)/budgets/[id]/page.tsx"
git commit -m "feat: update budget detail page for draft/publish"
```

---

### Task 12: Frontend — Update CreateBudgetDialog

**Files:**
- Modify: `apps/web/components/create-budget-dialog.tsx`

**Key changes:**
1. Remove cost center fetching and validation
2. Remove "no cost centers" warning
3. Simplify: just select project → POST creates draft budget with empty snapshot
4. Remove initial section creation (user adds rubros inline in the editor)
5. After creation, redirect to budget editor (already works)

**Step 1: Commit**

```bash
git add apps/web/components/create-budget-dialog.tsx
git commit -m "refactor: simplify create budget dialog (no cost center requirement)"
```

---

### Task 13: Frontend — Update ReceiptReview for rubros

**Files:**
- Modify: `apps/web/components/receipt-review.tsx`

**Key changes:**
1. Remove `useSWR<CostCenter[]>('/api/cost-centers', fetcher)`
2. When user selects a project:
   - Fetch the budget for that project: `useSWR(projectId ? /api/budgets?project_id=${projectId} : null)`
   - From the budget, get the budget_id
   - Fetch rubros: `useSWR(budgetId ? /api/rubros?budget_id=${budgetId} : null)`
3. Replace "Centro de Costos" label → "Rubro"
4. Dropdown items come from rubros (name + color dot)
5. State: `costCenterId` → `rubroId`
6. In `handleConfirm`: `cost_center_id` → `rubro_id` in payload

**Step 2: Commit**

```bash
git add apps/web/components/receipt-review.tsx
git commit -m "refactor: receipt review uses rubros from project budget"
```

---

### Task 14: Frontend — Update receipts list page

**Files:**
- Modify: `apps/web/app/(dashboard)/receipts/page.tsx`

**Key changes:**
1. Replace `useSWR<CostCenter[]>('/api/cost-centers')` → `useSWR<Rubro[]>('/api/rubros')`
2. Rename state: `costCenterFilter` → `rubroFilter`
3. Rename filter label: "Centro de Costos" → "Rubro"
4. Rename column header: "Centro de Costos" → "Rubro"
5. In filter logic: `receipt.cost_center_id` → `receipt.rubro_id`
6. In display: `receipt.cost_center` → `receipt.rubro`
7. Update `COST_CENTER_BADGE_STYLES` references → use inline color from rubro

**Step 1: Commit**

```bash
git add "apps/web/app/(dashboard)/receipts/page.tsx"
git commit -m "refactor: receipts page uses rubros instead of cost centers"
```

---

### Task 15: Frontend — Update receipt detail page

**Files:**
- Modify: `apps/web/app/(dashboard)/receipts/[id]/page.tsx`

**Key changes:**
1. Rename `cost_center` → `rubro` in display
2. Update any badge styling references

**Step 1: Commit**

```bash
git add "apps/web/app/(dashboard)/receipts/[id]/page.tsx"
git commit -m "refactor: receipt detail shows rubro instead of cost center"
```

---

### Task 16: Frontend — Update reports page

**Files:**
- Modify: `apps/web/app/(dashboard)/reports/page.tsx`
- Modify: `apps/web/components/reports/spend-by-cost-center-chart.tsx` (rename + update)

**Key changes:**
1. Fetch from `/api/reports/by-rubro` instead of `/api/reports/by-cost-center`
2. Use `RubroSpend` type instead of `CostCenterSpend`
3. Restructure table to show project → rubro hierarchy:
   - Top-level rows are projects (expandable)
   - Sub-rows are rubros within that project
4. Rename chart component file and update data shape
5. Update KPI calculations for new data structure

**Step 1: Commit**

```bash
git add "apps/web/app/(dashboard)/reports/page.tsx" apps/web/components/reports/
git commit -m "refactor: reports page groups by project > rubro"
```

---

### Task 17: Frontend — Update budgets list page

**Files:**
- Modify: `apps/web/app/(dashboard)/budgets/page.tsx`

**Key changes:**
1. Show `status` badge (Borrador / Publicado) in the table
2. Total amount for drafts: calculate from `budget.snapshot` instead of from versions
3. Import `Badge` for status display

**Step 1: Commit**

```bash
git add "apps/web/app/(dashboard)/budgets/page.tsx"
git commit -m "feat: budgets list shows draft/published status"
```

---

### Task 18: Codebase-wide rename — remaining cost_center references

**Files:**
- Search entire codebase for remaining `cost_center`, `costCenter`, `CostCenter`, `cost-center` references

**Step 1: Global search and replace**

Run:
```bash
grep -rn "cost.center\|CostCenter\|cost_center" apps/ packages/ --include="*.ts" --include="*.tsx"
```

Fix any remaining references. Common places:
- `api-types.ts` (already handled in Task 8)
- `project-colors.ts` (already handled in Task 8)
- Any remaining imports

**Step 2: TypeScript check**

Run: `cd apps/web && npx tsc --noEmit`

Fix all type errors.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: final cleanup of all cost_center references"
```

---

### Task 19: Verify full application

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Manual verification checklist**

- [ ] Create budget → starts as draft, empty editor
- [ ] Add rubro → inline name editing works
- [ ] Add items to rubro → autosave triggers after 2s
- [ ] "Guardar versión" → creates v1, switches to read-only
- [ ] "Editar presupuesto" → switches back to draft
- [ ] Upload receipt → select project → rubro dropdown shows budget rubros
- [ ] Receipts list → "Rubro" column and filter work
- [ ] Reports → grouped by project > rubro
- [ ] Settings → no "Centro de Costos" tab
- [ ] Budget history → historical versions are read-only
