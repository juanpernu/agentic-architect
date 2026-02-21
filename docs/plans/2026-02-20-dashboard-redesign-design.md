# Dashboard Redesign — Design Document

## Goal

Redesign the dashboard page (`/`) to match the mobile-first reference design, replacing generic shadcn cards and Recharts charts with a polished, branded UI. Components must be reusable for future migration of `/reports` and other views.

## Reference

- Screenshot: `/Users/juanpernu/Desktop/agentect_dashboard/screen.png`
- HTML/CSS: `/Users/juanpernu/Desktop/agentect_dashboard/code.html`

## Design Tokens (extend, don't replace shadcn)

Added to `globals.css` as CSS custom properties:

```css
:root {
  --kpi-blue: oklch(0.95 0.02 250);
  --kpi-emerald: oklch(0.95 0.03 165);
  --kpi-purple: oklch(0.95 0.03 300);
  --kpi-amber: oklch(0.95 0.04 85);
  --shadow-soft: 0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04);
}
```

Extended in Tailwind config: `boxShadow: { soft: 'var(--shadow-soft)' }`

## Scope

- **In scope**: Dashboard page only (`/`)
- **Out of scope**: Sidebar, bottom nav, FAB, `/reports`, other pages
- **Constraint**: shadcn is the base — extend only, never replace

## Components

### New — Reusable (`components/ui/`)

| Component | Purpose | Props |
|---|---|---|
| `stat-card.tsx` | KPI card: colored icon bg, large value, label, optional badge | `title, value, icon, iconBg, badge?: { label, variant }` |
| `progress-bar-list.tsx` | List with name + amount + proportional horizontal bar | `items: { label, value, formattedValue }[], maxItems?, actionLabel?, actionHref?` |
| `bar-chart-simple.tsx` | Vertical CSS bars with hover tooltips, dynamic heights | `data: { label, value, formattedValue }[], highlightLast?` |

### New — Dashboard-specific (`components/dashboard/`)

| Component | Purpose |
|---|---|
| `dashboard-greeting.tsx` | Client component: org name + "Hola, {firstName}!" via `useCurrentUser()` |

### Modified

| File | Change |
|---|---|
| `dashboard-kpis.tsx` | Use `StatCard` with badges (+N new projects, % monthly spend change) |
| `recent-receipts.tsx` | Circular avatar icon, relative dates ("Hoy", "Ayer"), reference layout, "Ver historial completo" footer |
| `page.tsx` (dashboard) | `DashboardGreeting` replaces `PageHeader`, new spacing `space-y-8` |
| `globals.css` | Add KPI color tokens + shadow-soft |

### Untouched

- All `components/ui/` shadcn components (Card, Badge, Button, etc.)
- `components/ui/kpi-card.tsx` — stays for `/reports` until migrated
- `components/reports/` — Recharts stays until reports migration
- Sidebar, bottom nav — out of scope
- Recharts dependency — stays in project, just unused by dashboard

## Visual Specification (from reference)

### Header
- Org name: `text-sm font-medium text-muted-foreground`
- Greeting: `text-2xl font-bold` with emoji wave
- Dynamic first name from `useCurrentUser().fullName.split(' ')[0]`

### Stat Cards (2x2 grid mobile, 4-col desktop)
- Fixed height `h-32`, `rounded-xl`, `shadow-soft`
- Icon in colored background circle: blue-50, emerald-50, purple-50, amber-50
- Large value: `text-2xl font-bold`
- Label: `text-xs text-muted-foreground`
- Optional badge: "+2" (green), "12%" (red/green with arrow)
- Hover: `hover:scale-[1.02] transition-transform`
- "Pendientes Review" card: amber pulse dot indicator

### Spend by Project (progress bar list)
- Card with "Gasto por Proyecto" title + "Ver Todo" action link
- Top 3-5 projects, each: name + compact amount + horizontal bar
- Bar width = `(projectSpend / maxSpend) * 100`%
- Bar colors: primary with decreasing opacity (primary, blue-400, blue-300)
- Bar height: `h-2`, rounded-full

### Monthly Trend (CSS bar chart)
- Card with "Tendencia Mensual" title + "Actual" legend dot
- Vertical bars, height = `(monthTotal / maxTotal) * 100`%
- Gradient: lighter bars (older) → primary (current month)
- Last bar: `shadow-lg shadow-primary/30`
- Dashed horizontal grid lines
- Month label tooltip on hover (CSS `group-hover`)
- Container: `h-40`, bars flexed with `items-end`

### Recent Receipts
- Section title outside card: "Comprobantes Recientes" + "Ver Todos" link
- Card with `divide-y` list (no individual borders per item)
- Each item: 40px circular avatar (gray bg + lucide icon) + vendor name + relative date + amount + status badge
- Status badges: green (Confirmado), amber (Pendiente), blue (Procesando AI)
- Footer: centered "Ver historial completo →" with subtle bg

## Desktop Scale-up

- Stat cards: `grid-cols-2 lg:grid-cols-4`
- Spend by Project + Trend: `md:grid-cols-2` side by side
- Recent receipts: full width below charts

## Data Flow

No changes to data fetching. Same server component queries:
- `fetchStats()` → stat cards (add previous month comparison for % badge)
- `fetchSpendByProject()` → progress bar list
- `fetchSpendTrend()` → bar chart
- `fetchRecentReceipts()` → receipt list

One addition: `fetchStats()` needs to also fetch previous month's spend to calculate the % change badge.
