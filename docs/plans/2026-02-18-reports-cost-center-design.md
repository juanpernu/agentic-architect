# Reports: Spend by Cost Center — Design Document

**Date:** 2026-02-18
**Status:** Approved

## Goal

Add a Reports section to ObraLink that shows spend aggregated by cost center, with drill-down to individual receipts. Admin and Supervisor roles only.

## Approach

Server-side SQL aggregation via a dedicated API endpoint. Recharts for visualization. Drill-down reutilizes the existing `/api/receipts` endpoint with cost center filter.

## API

### `GET /api/reports/by-cost-center`

**Permissions:** Admin and Supervisor only. Architects receive 403.

**Query params (all optional):**
- `project_id` — filter by project
- `date_from` — ISO date lower bound
- `date_to` — ISO date upper bound

**Response:**
```json
[
  {
    "cost_center_id": "uuid",
    "cost_center_name": "Materiales",
    "cost_center_color": "blue",
    "total_amount": 150000,
    "receipt_count": 12
  }
]
```

**SQL logic:** `SELECT cost_center_id, SUM(total_amount), COUNT(*)` from `receipts` joined with `cost_centers`, filtered by `status = 'confirmed'` and optional project/date filters. Grouped by `cost_center_id`. Scoped to org via RLS.

### Drill-down

Reutilizes existing `GET /api/receipts` with query params `cost_center_id`, `project_id`, `status=confirmed`, and date filters. No new endpoint needed.

## UI

### Page: `/reports`

**Permissions:** Sidebar link visible only for Admin and Supervisor roles.

**Layout (top to bottom):**

1. **PageHeader** — "Reportes" with description
2. **Filters row** — Project select + date range (From/To), same Field/Select/Input components used in `/receipts`
3. **KPI Cards (2-3):**
   - Total spend (sum across all cost centers)
   - Receipt count
   - Highest-spend cost center
4. **Bar Chart** — Horizontal BarChart (Recharts) with each bar colored by cost center color. Tooltip shows formatted currency.
5. **Summary Table** — Columns: Cost Center (badge with color), Receipts count, Total amount, % of total. Rows are clickeable.

### Drill-down (inline accordion)

Clicking a table row expands it to show a nested table of individual receipts for that cost center:
- Columns: Vendor, Project, Date, Amount, Status
- Each receipt row links to `/receipts/[id]`
- Data fetched from `/api/receipts?cost_center_id=xxx` with same project/date filters
- Empty state: "No hay comprobantes para este centro de costos"

## Navigation

Add to sidebar `navItems` array:
```ts
{ href: '/reports', label: 'Reportes', icon: BarChart3, roles: ['admin', 'supervisor'] }
```

Add `roles?: string[]` field to navItem type. Filter `visibleNavItems` by user role when `roles` is defined.

## Shared Types

```ts
export interface CostCenterSpend {
  cost_center_id: string;
  cost_center_name: string;
  cost_center_color: string | null;
  total_amount: number;
  receipt_count: number;
}
```

## Out of Scope

- Export to Excel/PDF (future iteration)
- Reports by project or by period (future iterations)
- Comparisons between projects
- Budget vs. actual tracking
