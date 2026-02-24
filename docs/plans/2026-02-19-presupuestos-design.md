# Presupuestos de Obra — Design Document

**Date:** 2026-02-19
**Status:** Approved

## Goal

Add project budgets ("presupuestos") to Agentect. Each project has one budget that evolves over time — every save creates a new immutable version (snapshot). Budget sections map to existing cost centers, with line items for materials, labor, etc.

## Approach

Snapshot-based versioning using JSONB. Each budget version stores the complete budget structure as a JSON document. This gives natural immutability, simple reads (1 query = full budget), and easy version comparison without complex JOINs.

## Data Model

### Table: `budgets`

One row per project (1:1 relationship).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Default gen_random_uuid() |
| project_id | UUID FK → projects | UNIQUE constraint |
| organization_id | TEXT FK → organizations | For RLS |
| current_version | INT | Latest version number |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Default now() |

### Table: `budget_versions`

One row per save. Immutable after creation.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Default gen_random_uuid() |
| budget_id | UUID FK → budgets | |
| version_number | INT | Sequential within budget |
| snapshot | JSONB | Full budget structure |
| total_amount | NUMERIC | Pre-calculated total for queries |
| created_by | UUID FK → users | Who saved |
| created_at | TIMESTAMPTZ | Default now() |

### Snapshot JSONB structure

```json
{
  "sections": [
    {
      "cost_center_id": "uuid",
      "cost_center_name": "Albañilería",
      "subtotal": 1500000,
      "items": [
        {
          "description": "Ladrillos huecos 12x18x33",
          "quantity": 5000,
          "unit": "unidad",
          "unit_price": 150,
          "subtotal": 750000
        }
      ]
    }
  ]
}
```

### RLS

- `budgets`: `organization_id = public.get_org_id()`
- `budget_versions`: via JOIN with `budgets.organization_id`
- Write access: admin and supervisor only. Architect: read-only.

### Indexes

- `budgets(project_id)` — UNIQUE
- `budgets(organization_id)`
- `budget_versions(budget_id, version_number)` — UNIQUE
- `budget_versions(budget_id)` — for listing versions

## API

### `GET /api/budgets`

List budgets with latest version metadata (no snapshot).

**Query params (optional):** `project_id`

**Permissions:** All roles.

**Response:**
```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "project_name": "Casa Martinez",
    "current_version": 3,
    "total_amount": 5000000,
    "updated_at": "2026-02-19T..."
  }
]
```

### `GET /api/budgets/:id`

Budget with latest version snapshot. Optional `?version=N` for specific version.

**Permissions:** All roles.

### `POST /api/budgets`

Create budget for a project. Body: `{ project_id, snapshot }`.

Creates `budgets` row (current_version=1) + first `budget_version`.

Validates project doesn't already have a budget.

**Permissions:** Admin, Supervisor.

### `PUT /api/budgets/:id`

Save changes = create new version. Body: `{ snapshot }`.

Inserts new `budget_version`, increments `current_version`, calculates `total_amount`.

**Permissions:** Admin, Supervisor.

### `GET /api/budgets/:id/versions`

List all versions without snapshots (for history timeline).

**Response:**
```json
[
  {
    "version_number": 3,
    "total_amount": 5000000,
    "created_by_name": "Juan Pérez",
    "created_at": "2026-02-19T..."
  }
]
```

### `GET /api/budgets/:id/versions/:version`

Full snapshot of a specific version (read-only view).

**Permissions:** All roles.

### Permissions summary

| Endpoint | Admin | Supervisor | Architect |
|----------|-------|------------|-----------|
| GET (list/view) | Yes | Yes | Yes |
| POST (create) | Yes | Yes | No |
| PUT (new version) | Yes | Yes | No |

No DELETE endpoint — budgets are immutable history.

## UI

### Navigation

New sidebar item **"Presupuestos"** between "Cargar" and "Reportes". Icon: `Calculator` or `FileSpreadsheet`. Visible to all roles.

### Page: `/budgets` — Budget list

- `PageHeader`: title "Presupuestos", description, button "Nuevo presupuesto" (admin/supervisor)
- Search by project name
- Table: Proyecto | Versión actual | Total | Última actualización
- Click row → navigate to `/budgets/:id`
- "Nuevo presupuesto" opens `CreateBudgetDialog` — project selector (only projects without budget)

### Page: `/budgets/:id` — Budget editor

**Header:**
- Project name, current version badge, total amount
- "Guardar" button (admin/supervisor only)

**Body:**
- Accordion sections, one per rubro/cost center
- Each section: cost center name, subtotal, table of items
- Items table: description, quantity, unit, unit price, subtotal (calculated)
- Inline editing of all item fields
- "+ Agregar ítem" button per section
- "+ Agregar rubro" button to add a cost center section
- Remove buttons for items and empty sections

**Footer:**
- Total general del presupuesto

**Save flow:**
1. User clicks "Guardar"
2. Confirmation dialog: "Una vez guardado, esta versión no se puede modificar. ¿Querés guardar el presupuesto?" → [Cancelar] [Guardar versión]
3. On confirm → PUT request → toast "Versión N guardada"

**Unsaved changes:**
- Navigation away triggers dialog: "Tenés cambios sin guardar, ¿querés salir?"

### Page: `/budgets/:id/history` (or tab within detail)

- Timeline of versions: version number, total, who saved, when
- Click version → read-only view of that snapshot

### Access from project detail

- In `/projects/:id`, add link/button to project budget
- If budget exists → "Ver presupuesto" link
- If no budget → "Crear presupuesto" button (admin/supervisor)

### Key components

| Component | Description |
|-----------|-------------|
| `BudgetList` | Table with search |
| `BudgetEditor` | Main editor with sections + items |
| `BudgetSectionCard` | Accordion for one rubro with items table |
| `BudgetItemRow` | Editable item row |
| `BudgetVersionHistory` | Version timeline |
| `CreateBudgetDialog` | Dialog to create budget choosing project |
| `SaveBudgetDialog` | Confirmation before saving |

## Validations

- `description`: required, non-empty
- `quantity`: required, > 0
- `unit`: required, non-empty
- `unit_price`: required, >= 0
- `subtotal`: auto-calculated (quantity × unit_price), not user-editable
- Budget must have at least 1 section with at least 1 item to save
- Empty sections (0 items) are allowed while editing but not on save

## Edge cases

| Case | Behavior |
|------|----------|
| Project without budget | Show "Crear presupuesto" in project detail |
| Project already has budget | Not shown in create dialog |
| Section without items | Allowed while editing, blocked on save |
| Architect tries to edit | Fields disabled, no Save button |
| Deleted cost center | Snapshot preserves name as historical data |
| Navigate without saving | Confirmation dialog |

## Testing

- Unit tests: subtotal/total calculations, snapshot validation
- API tests: CRUD, role-based permissions, version number sequencing
- Snapshot schema validation

## Out of scope (future)

- Budget vs. actual spend comparison
- Export to PDF / send by email
- Budget templates
