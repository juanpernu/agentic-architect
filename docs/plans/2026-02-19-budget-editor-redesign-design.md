# Budget Editor Redesign — Design Document

**Date:** 2026-02-19
**Status:** Approved

## Goal

Redesign the budget editor UI from accordion-based sections to a single continuous table matching the construction industry standard spreadsheet layout. Update the data model to support manual cost/subtotal fields, additional sections, and reorderable cost centers.

## What Changes

The backend infrastructure (tables, API endpoints, versionado, navigation) stays the same. Changes are localized to the snapshot structure, shared types, Zod schemas, and UI components.

## Data Model Changes

### BudgetItem — before vs after

```
BEFORE: { description, quantity, unit, unit_price, subtotal }  ← subtotal auto-calculated
AFTER:  { description, unit, quantity, cost, subtotal }        ← both manual
```

- `unit_price` removed, replaced by `cost` (actual price, internal)
- `subtotal` is now manual (client-facing price with margin)
- Neither `cost` nor `subtotal` are auto-calculated at item level

### BudgetSection — before vs after

```
BEFORE: { cost_center_id, cost_center_name, subtotal, items[] }
AFTER:  { cost_center_id, cost_center_name, is_additional, items[] }
```

- `subtotal` removed from section (calculated as sum of items in UI)
- `is_additional` added to distinguish base vs additional sections

### Snapshot JSONB structure

```json
{
  "sections": [
    {
      "cost_center_id": "uuid",
      "cost_center_name": "TAREAS PRELIMINARES",
      "is_additional": false,
      "items": [
        {
          "description": "Presentacion de documentacion del personal",
          "unit": "Global",
          "quantity": 1,
          "cost": 40000,
          "subtotal": 50000
        }
      ]
    },
    {
      "cost_center_id": "uuid",
      "cost_center_name": "PILETA",
      "is_additional": true,
      "items": [...]
    }
  ]
}
```

### Totals (calculated in UI, not stored)

- **Section totals**: `total_cost = sum(items.cost)`, `total_subtotal = sum(items.subtotal)`
- **Grand total (base)**: sum of sections where `is_additional = false`
- **Grand total (additional)**: sum of sections where `is_additional = true`

### Zod schema

```typescript
const budgetItemSchema = z.object({
  description: z.string().min(1, 'La descripcion es requerida'),
  unit: z.string(),
  quantity: z.number().min(0),
  cost: z.number().min(0),
  subtotal: z.number().min(0),
});

const budgetSectionSchema = z.object({
  cost_center_id: z.string().uuid(),
  cost_center_name: z.string(),
  is_additional: z.boolean(),
  items: z.array(budgetItemSchema).min(1),
});

const budgetSnapshotSchema = z.object({
  sections: z.array(budgetSectionSchema).min(1),
});
```

## UI Design

### Table layout

Single continuous table with cost centers as header rows (dark background) and items as regular editable rows.

**Columns:** Item | Descripcion de tareas de obra base | Unidad | Cantidad | Subtotal | Costo

```
| Item | Descripcion                       | Unidad | Cant | Subtotal     | Costo       |
|------|-----------------------------------|--------|------|--------------|-------------|
| 1    | **TAREAS PRELIMINARES**           |        |      | $170.000     | $140.000    |
| 1,1  | Presentacion documentacion...     | gl     | 1    | $50.000      | $40.000     |
| 1,2  | Retiro de puertas interiores      | gl     | 1    | $120.000     | $100.000    |
| 2    | **ALBANILERIA**                   |        |      | $375.000     | $300.000    |
| 2,1  | Demolicion de tabiques...         | m2     | 25   | $375.000     | $300.000    |
|------|-----------------------------------|--------|------|--------------|-------------|
|      | **TOTAL**                         |        |      | **$545.000** | **$440.000**|
|------|-----------------------------------|--------|------|--------------|-------------|
|      | **Adicional**                     |        |      |              |             |
| 3    | **PILETA**                        |        |      | $12.870.000  |             |
| 3,1  | Pileta de 2 x 4 mts...           | gl     | 1    | $12.870.000  |             |
|------|-----------------------------------|--------|------|--------------|-------------|
|      | **TOTAL ADICIONAL**               |        |      |**$12.870.000**|            |
```

### Section header rows (cost center)

- Dark background (navy/slate), bold text
- Show section number and cost center name
- Show section totals for Subtotal and Costo columns
- Unidad and Cantidad columns empty
- Not inline editable — name comes from cost center

### Item rows

- White background, all fields editable inline
- Hierarchical numbering: `{sectionNumber},{itemIndex}` (e.g., 1,1 / 1,2 / 2,1)
- Fields: description (text input), unit (text input), quantity (number input), cost (number input), subtotal (number input)

### Actions

- **Add section**: select from available cost centers, choose base or additional
- **Add item**: "+" button at end of each section
- **Remove item**: trash button per row
- **Remove section**: trash button on section header
- **Reorder sections**: up/down arrow buttons on section header rows
- **Toggle Costo column**: button/switch near the Save button to hide/show the Costo column
- **Base sections reorder among base, additional among additional**

### Components

| Component | Replaces | Description |
|-----------|----------|-------------|
| `BudgetTable` | `BudgetEditor` | Main table with all editing logic |
| `BudgetSectionRow` | `BudgetSectionCard` | Header row for a cost center |
| `BudgetItemRow` | (was inline in card) | Editable item row |
| `SaveBudgetDialog` | (unchanged) | Confirmation before saving |

## Backend Changes

### Shared types (`packages/shared/src/types.ts`)

Update `BudgetItem`: remove `unit_price`, add `cost`, keep `subtotal` (manual).
Update `BudgetSection`: remove `subtotal`, add `is_additional: boolean`.

### API total_amount calculation

Both POST and PUT endpoints calculate `total_amount` by summing `item.subtotal` across all items in all sections:

```typescript
const totalAmount = sections.reduce((sum, s) =>
  sum + s.items.reduce((itemSum, i) => itemSum + (Number(i.subtotal) || 0), 0)
, 0);
```

### CreateBudgetDialog

Initial snapshot template updated to use new field names (`cost: 0, subtotal: 0` instead of `unit_price: 0, subtotal: 0`), and `is_additional: false`.

## Edge Cases

| Case | Behavior |
|------|----------|
| Section without items | Not allowed on save (Zod: min 1 item) |
| Item with cost/subtotal = 0 | Allowed (price not yet defined) |
| Move base section to additional | Not supported — delete and re-add |
| All sections are additional | Only Additional section shown, no base TOTAL |
| No additional sections | Additional section and TOTAL ADICIONAL hidden |
| Additional numbering | Continues from base (base 1-10, additional starts at 11) |
| Reorder across base/additional | Not allowed — base reorders among base, additional among additional |

## Out of Scope

- Observaciones column (future)
- Export to PDF / send by email
- Budget vs actual spend comparison
- Drag & drop reordering (using arrow buttons instead)
