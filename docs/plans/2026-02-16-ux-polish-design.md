# UX Polish Design

## Goal

Add subtle, professional visual polish (Vercel/Linear style) and fix UX issues across all pages of Architech. CSS-only approach with zero bundle size impact.

## Scope

1. Animation system (CSS-only)
2. Spacing unification
3. Dashboard chart fixes
4. Project cards: show address
5. Project detail: architect avatars
6. Project color tags (cross-app feature)
7. Receipts table: colored project badges

## Design Decisions

### 1. Animation System (CSS-only)

Three reusable CSS animations defined in `globals.css`:

- **`fade-in`**: opacity 0→1, 200ms ease-out. For content appearing (cards, modals, toasts).
- **`slide-up`**: translateY(8px)→0 + fade-in, 300ms ease-out. For page content and card grids.
- **`stagger`**: Each child gets incremental 50ms delay via `nth-child`. For card grids and table rows.

Application:
- Page content uses `slide-up` on mount
- Skeletons use `fade-in`
- Card grids (projects, KPIs) use stagger
- No JavaScript animation libraries needed; `tw-animate-css` already installed

### 2. Spacing Unification

Current state: inconsistent `p-4` vs `p-6`, variable gaps.

Normalized values:
- **Page padding**: `p-6` everywhere
- **Grid gap (cards)**: `gap-4`
- **Section gap (vertical)**: `gap-6` between sections, `gap-4` within
- **Container max-width**: `max-w-7xl mx-auto` on all pages

### 3. Dashboard — Recharts Axis Fix

Problem: X/Y axis labels get cut off because charts lack explicit margins.

Fix:
- Add `margin={{ left: 12, right: 12, top: 8, bottom: 4 }}` to both BarChart and LineChart
- Set `width={60}` on YAxis to accommodate peso amounts
- Abbreviate Y-axis ticks: `$1.2M`, `$500K` instead of full numbers
- Keeps chart height at 300px

### 4. Projects Page — Address in Card

Add `address` field below project name in each card.
- Text: `text-sm text-muted-foreground`
- Icon: MapPin from lucide-react
- If `address` is null, row is hidden (no empty space)

### 5. Projects/[id] — Architect Avatar

Replace the User icon with Avatar component (shadcn, already installed).
- Show Clerk avatar image if available
- Fallback: initials from full name
- Keep name and email text below

### 6. Color Tags for Projects (Feature #40)

**Database**: Add `color TEXT DEFAULT NULL` column to `projects` table via migration `004_project_color.sql`.

**Type**: Add to shared types:
```typescript
export type ProjectColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'pink' | 'teal';
```
Add `color: ProjectColor | null` to Project interface.

**Color palette** (Tailwind classes mapping):
| Name   | Dot class      | Badge bg class      |
|--------|---------------|---------------------|
| red    | bg-red-500    | bg-red-100 text-red-700 |
| blue   | bg-blue-500   | bg-blue-100 text-blue-700 |
| green  | bg-green-500  | bg-green-100 text-green-700 |
| yellow | bg-yellow-500 | bg-yellow-100 text-yellow-700 |
| purple | bg-purple-500 | bg-purple-100 text-purple-700 |
| orange | bg-orange-500 | bg-orange-100 text-orange-700 |
| pink   | bg-pink-500   | bg-pink-100 text-pink-700 |
| teal   | bg-teal-500   | bg-teal-100 text-teal-700 |

**Form**: Add color picker to `project-form-dialog.tsx` — 8 colored circles in a row, clickable. Optional field (can leave unselected). Selected circle gets a ring indicator.

**Visual indicator**: Small colored dot (8px, rounded-full) next to project name wherever it appears.

### 7. Receipts Table — Colored Project Badge

**Blocked by**: Feature #40 (color tags)

Replace the current `<span className="text-primary hover:underline">` with a `Badge` component:
- Background: project color (from palette above)
- Text: project name
- Click: navigates to project detail
- If project has no color: fallback to current `text-primary` link style

## Tech Stack

- CSS animations (no new dependencies)
- Tailwind CSS 4 utilities
- Recharts (existing, config changes only)
- shadcn/ui Avatar (already installed)
- Supabase migration for DB column

## Architecture

No new components needed beyond the color picker in the project form. All changes are modifications to existing files. The animation classes are global utilities in `globals.css`.
