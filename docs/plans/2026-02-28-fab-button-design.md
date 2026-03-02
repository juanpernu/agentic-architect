# FAB (Floating Action Button) — Design

**Goal:** Add a Material-style speed dial FAB on mobile to give quick access to all creation actions.

**Architecture:** Standalone component mounted in dashboard layout. Navigation-only (no inline dialogs). Pages read `?create=true` query param to auto-open their create dialog.

## Component: FloatingActionButton

- **Position:** `fixed bottom-6 right-6`, z-50
- **Visibility:** Mobile only (`md:hidden`), hidden on `/upload`, `/receipts/[id]`, `/settings/billing`
- **Main button:** Circle with `Plus` icon, primary color, rotates 45° when open
- **Speed dial:** 5 options animate upward with staggered timing
- **Backdrop:** Semi-transparent overlay, closes on tap

## Actions (bottom to top)

| Label | Icon | Destination |
|-------|------|-------------|
| Comprobante | `Sparkles` | `/upload` |
| Proyecto | `FolderKanban` | `/projects?create=true` |
| Presupuesto | `Calculator` | `/budgets?create=true` |
| Egreso | `TrendingDown` | `/administration/expenses?create=true` |
| Ingreso | `TrendingUp` | `/administration/incomes?create=true` |

## Hidden on pages

- `/upload` — has its own upload flow
- `/receipts/[id]` — has sticky footer actions
- `/settings/billing` — checkout flow

## Files

- **Create:** `apps/web/components/floating-action-button.tsx`
- **Modify:** `apps/web/app/(dashboard)/layout.tsx` — mount FAB
- **Modify:** `apps/web/app/(dashboard)/projects/page.tsx` — read `?create=true`
- **Modify:** `apps/web/app/(dashboard)/budgets/page.tsx` — read `?create=true`
- **Modify:** `apps/web/app/(dashboard)/administration/expenses/page.tsx` — read `?create=true`
- **Modify:** `apps/web/app/(dashboard)/administration/incomes/page.tsx` — read `?create=true`
