# Rubros & Budget Autosave — Design Document

**Date:** 2026-02-20
**Status:** Approved

## Goal

Refactor budget sections from org-level cost centers to budget-scoped rubros with inline creation, and implement a draft/publish workflow with autosave.

## Context

Currently, cost centers are global entities managed in `/settings/cost-centers`. All budgets share the same set of cost centers. This limits flexibility — each budget should define its own rubros (categories) independently.

Additionally, the current save flow requires an explicit "Guardar" action. We need autosave for drafts and an explicit "Guardar versión" action that creates a version snapshot.

## Architecture

### Data Model

#### Table `rubros` (replaces `cost_centers`)

```sql
CREATE TABLE rubros (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id  UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- Rubros belong to a budget, not to the org
- RLS inherits org scope through budget → project → org chain

#### Changes to `budgets`

```sql
ALTER TABLE budgets
  ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published'));
```

- `snapshot` JSONB is the live draft (autosave writes here)
- `status = 'draft'`: editable, autosave active
- `status = 'published'`: read-only

#### Changes to `receipts`

```sql
ALTER TABLE receipts RENAME COLUMN cost_center_id TO rubro_id;
ALTER TABLE receipts
  ADD CONSTRAINT receipts_rubro_id_fkey
  FOREIGN KEY (rubro_id) REFERENCES rubros(id);
```

#### Snapshot JSON (`BudgetSection`)

```typescript
interface BudgetSection {
  rubro_id: string;       // FK to rubros.id
  rubro_name: string;     // denormalized for display
  is_additional: boolean;
  subtotal?: number;
  cost?: number;
  items: BudgetItem[];
}
```

### Budget State Machine

```
  [create budget]
        ↓
     DRAFT  ←──────────────────┐
   (editable,                  │
    autosave)                  │
        │                      │
   "Guardar versión"     "Editar presupuesto"
        │                      │
        ↓                      │
   PUBLISHED ──────────────────┘
   (read-only)
```

- Only the latest version is editable (via "Editar presupuesto")
- Previous versions are immutable snapshots in `budget_versions`

### Autosave

**Strategy:** Debounce 2 seconds after last change.

```
User edits → 2s timer → PATCH /api/budgets/:id { snapshot }
                        → toast "Borrador guardado"
```

- Each change resets the timer
- Only sends if snapshot actually changed (deep compare)
- Status indicator in header: "Guardando..." → "Borrador guardado"
- On error: persistent "Error al guardar" with retry button

**Frontend hook:**

```typescript
// useAutosave(budgetId, snapshot, enabled)
// - enabled = true only when status === 'draft'
// - Returns { saveStatus: 'idle' | 'saving' | 'saved' | 'error' }
```

**API guard:** `PATCH /api/budgets/:id` rejects updates when `status = 'published'`.

### Publish Flow ("Guardar versión")

1. `POST /api/budgets/:id/versions` → creates row in `budget_versions`
2. `PATCH /api/budgets/:id` → `status = 'published'`, increment `current_version`
3. UI returns to read-only mode
4. Toast: "Versión vX guardada"

### Edit Flow ("Editar presupuesto")

1. `PATCH /api/budgets/:id` → `status = 'draft'`
2. UI enables editing + activates autosave
3. Banner: "Editando · Los cambios se guardan automáticamente"

## UI Changes

### Editor States

| State | Header | Actions | Editor |
|-------|--------|---------|--------|
| `published` | "Presupuesto vX" | "Editar presupuesto" button | Disabled, read-only |
| `draft` | "Presupuesto (borrador)" + autosave indicator | "Guardar versión" button | Fully editable |

### Rubros in Editor

- "Agregar sección" creates a new rubro with editable name (placeholder: "Nuevo rubro")
- On create: POST to `rubros` table with `budget_id` + name
- Section header is an `<Input>` (replaces the cost center `<Select>`)
- Name changes sync to both `rubros` table and `rubro_name` in snapshot

### Receipt Upload

1. User selects project
2. System resolves budget for that project
3. "Rubro" dropdown fills with rubros from that budget
4. If project has no budget → dropdown empty with message "Este proyecto no tiene presupuesto con rubros"

### Receipt List

- Column "Centro de Costos" → "Rubro"
- Filter "Centro de Costos" → "Rubro"
- Filter dropdown loads all rubros across budgets for the org

### Reports

- Rename `/api/reports/by-cost-center` → `/api/reports/by-rubro`
- Group by project → rubro (hierarchical)
- Table shows project rows, expandable to rubros within that project

## API

### New: `/api/rubros`

```
GET    /api/rubros                → all rubros for the org (for filters)
GET    /api/rubros?budget_id=X   → rubros for a specific budget
POST   /api/rubros               → create rubro { budget_id, name, color? }
PATCH  /api/rubros/:id           → update name/color
DELETE /api/rubros/:id           → delete rubro (only if no receipts reference it)
```

### Modified

- `PATCH /api/budgets/:id` — reject when `status = 'published'` (except status change)
- `POST /api/budgets/:id/versions` — only allowed when `status = 'draft'`
- `/api/reports/by-cost-center` → `/api/reports/by-rubro`

## Cleanup (full removal)

- DROP TABLE `cost_centers`
- Delete page `/settings/cost-centers`
- Delete API `/api/cost-centers` and `/api/cost-centers/[id]`
- Remove navigation link to cost-centers in settings
- Delete type `CostCenter` from `@architech/shared`
- Delete `costCenterSchema` from schemas
- Delete `COST_CENTER_BADGE_STYLES`, `COST_CENTER_COLOR_HEX` from `project-colors.ts`
- Rename all `cost_center` → `rubro` references across codebase

## Naming Convention

- DB: `rubros`, `rubro_id`
- TypeScript: `Rubro`, `rubroId`
- UI labels (Spanish): "Rubro", "Rubros"
