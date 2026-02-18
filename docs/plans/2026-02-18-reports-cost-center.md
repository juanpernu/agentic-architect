# Reports: Spend by Cost Center — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Reports page showing spend aggregated by cost center, with bar chart, summary table, inline drill-down to individual receipts, and KPI cards. Admin and Supervisor only.

**Architecture:** Client-side page (`'use client'`) with SWR data fetching, matching the receipts page pattern. A new API endpoint performs SQL aggregation on the server. Drill-down reuses the existing `/api/receipts` endpoint. Sidebar navigation gains role-based filtering.

**Tech Stack:** Next.js App Router, SWR, Recharts (BarChart), Supabase (Postgres), Tailwind CSS, shadcn/ui components.

---

### Task 1: Add `CostCenterSpend` shared type

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add the type**

At the end of the file, after `SpendTrend`, add:

```ts
export interface CostCenterSpend {
  cost_center_id: string;
  cost_center_name: string;
  cost_center_color: string | null;
  total_amount: number;
  receipt_count: number;
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit --project packages/shared/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add CostCenterSpend type for reports"
```

---

### Task 2: Create API endpoint `/api/reports/by-cost-center`

**Files:**
- Create: `apps/web/app/api/reports/by-cost-center/route.ts`

**Context:**
- Auth pattern: import `getAuthContext`, `unauthorized`, `forbidden` from `@/lib/auth`
- DB pattern: import `getDb` from `@/lib/supabase`
- Permission: reject if `ctx.role === 'architect'`
- Only aggregate `status = 'confirmed'` receipts
- Scope to org via join with `cost_centers.organization_id`

**Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  const db = getDb();

  let query = db
    .from('receipts')
    .select('total_amount, cost_center:cost_centers!inner(id, name, color, organization_id)')
    .eq('status', 'confirmed')
    .eq('cost_center.organization_id', ctx.orgId);

  if (projectId) query = query.eq('project_id', projectId);
  if (dateFrom) query = query.gte('receipt_date', dateFrom);
  if (dateTo) query = query.lte('receipt_date', dateTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate in JS (Supabase client doesn't support GROUP BY)
  const map = new Map<string, { name: string; color: string | null; total: number; count: number }>();

  for (const row of data ?? []) {
    const cc = row.cost_center as unknown as { id: string; name: string; color: string | null };
    if (!cc) continue;
    const existing = map.get(cc.id);
    if (existing) {
      existing.total += Number(row.total_amount);
      existing.count += 1;
    } else {
      map.set(cc.id, { name: cc.name, color: cc.color, total: Number(row.total_amount), count: 1 });
    }
  }

  const result = Array.from(map.entries()).map(([id, val]) => ({
    cost_center_id: id,
    cost_center_name: val.name,
    cost_center_color: val.color,
    total_amount: val.total,
    receipt_count: val.count,
  }));

  // Sort by total_amount descending
  result.sort((a, b) => b.total_amount - a.total_amount);

  return NextResponse.json(result);
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/api/reports/by-cost-center/route.ts
git commit -m "feat: add reports by cost center API endpoint"
```

---

### Task 3: Create bar chart component

**Files:**
- Create: `apps/web/components/reports/spend-by-cost-center-chart.tsx`

**Context:**
- Follow the exact pattern from `apps/web/components/dashboard/spend-by-project-chart.tsx`
- Use horizontal `BarChart` with `layout="vertical"` so cost center names are Y-axis labels
- Color each bar using `COST_CENTER_BADGE_STYLES` from `@/lib/project-colors`
- Use `formatCurrency` / `formatCurrencyCompact` from `@/lib/format`

**Step 1: Create the chart component**

```tsx
'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import { COST_CENTER_BADGE_STYLES } from '@/lib/project-colors';
import type { CostCenterSpend } from '@architech/shared';
import type { ProjectColor } from '@architech/shared';

const currencyTickFormatter = (value: number) => formatCurrencyCompact(value);
const currencyTooltipFormatter = (value: number | undefined) => formatCurrency(Number(value ?? 0));

const DEFAULT_BAR_COLOR = 'hsl(var(--primary))';

export function SpendByCostCenterChart({ data }: { data: CostCenterSpend[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gasto por Centro de Costos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gasto por Centro de Costos</CardTitle>
      </CardHeader>
      <CardContent role="img" aria-label="Gráfico de barras: gasto por centro de costos">
        <ResponsiveContainer width="100%" height={Math.max(300, data.length * 50)}>
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={currencyTickFormatter}
            />
            <YAxis
              type="category"
              dataKey="cost_center_name"
              className="text-xs"
              width={120}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              formatter={currencyTooltipFormatter}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="total_amount" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.cost_center_id}
                  fill={
                    entry.cost_center_color && COST_CENTER_BADGE_STYLES[entry.cost_center_color as ProjectColor]
                      ? COST_CENTER_BADGE_STYLES[entry.cost_center_color as ProjectColor].text
                      : DEFAULT_BAR_COLOR
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/components/reports/spend-by-cost-center-chart.tsx
git commit -m "feat: add spend by cost center bar chart component"
```

---

### Task 4: Create reports page with KPIs, filters, chart, summary table, and drill-down

**Files:**
- Create: `apps/web/app/(dashboard)/reports/page.tsx`

**Context:**
- This is a `'use client'` page, similar to `apps/web/app/(dashboard)/receipts/page.tsx`
- Uses `useSWR` with `fetcher` from `@/lib/fetcher`
- Filters: project select + date range (From/To) — same pattern as receipts page
- KPI cards: use `KPICard` from `@/components/ui/kpi-card`
- Summary table: use `Table` components from `@/components/ui/table`
- Drill-down: clicking a row fetches receipts from `/api/receipts?cost_center_id=xxx` and shows inline
- Badge colors: use `COST_CENTER_BADGE_STYLES` from `@/lib/project-colors`
- Empty state: use `EmptyState` from `@/components/ui/empty-state`
- Loading: use `LoadingTable` from `@/components/ui/loading-skeleton`
- StatusBadge for receipt status in drill-down

**Step 1: Create the page**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { BarChart3, DollarSign, Receipt, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import type { CostCenterSpend, Project } from '@architech/shared';
import type { ReceiptWithDetails } from '@/lib/api-types';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { KPICard } from '@/components/ui/kpi-card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingTable } from '@/components/ui/loading-skeleton';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { COST_CENTER_BADGE_STYLES } from '@/lib/project-colors';
import { SpendByCostCenterChart } from '@/components/reports/spend-by-cost-center-chart';

export default function ReportsPage() {
  const router = useRouter();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedCostCenter, setExpandedCostCenter] = useState<string | null>(null);

  // Build query string for report API
  const reportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (projectFilter !== 'all') params.set('project_id', projectFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [projectFilter, dateFrom, dateTo]);

  const { data: reportData, isLoading: isLoadingReport, error } = useSWR<CostCenterSpend[]>(
    `/api/reports/by-cost-center${reportParams}`,
    fetcher
  );

  const { data: projects } = useSWR<Project[]>('/api/projects', fetcher);

  // Build query string for drill-down receipts
  const drilldownParams = useMemo(() => {
    if (!expandedCostCenter) return '';
    const params = new URLSearchParams();
    params.set('cost_center_id', expandedCostCenter);
    params.set('status', 'confirmed');
    if (projectFilter !== 'all') params.set('project_id', projectFilter);
    return `?${params.toString()}`;
  }, [expandedCostCenter, projectFilter]);

  const { data: drilldownReceipts, isLoading: isLoadingDrilldown } = useSWR<ReceiptWithDetails[]>(
    expandedCostCenter ? `/api/receipts${drilldownParams}` : null,
    fetcher
  );

  // Filter drill-down receipts by date range client-side (receipts API doesn't have date params)
  const filteredDrilldown = useMemo(() => {
    if (!drilldownReceipts) return [];
    return drilldownReceipts.filter((r) => {
      if (dateFrom && r.receipt_date < dateFrom) return false;
      if (dateTo && r.receipt_date > dateTo) return false;
      return true;
    });
  }, [drilldownReceipts, dateFrom, dateTo]);

  // KPI calculations
  const totalSpend = reportData?.reduce((sum, r) => sum + r.total_amount, 0) ?? 0;
  const totalReceipts = reportData?.reduce((sum, r) => sum + r.receipt_count, 0) ?? 0;
  const topCostCenter = reportData?.[0]; // Already sorted desc by API

  const handleToggleCostCenter = (costCenterId: string) => {
    setExpandedCostCenter((prev) => (prev === costCenterId ? null : costCenterId));
  };

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Reportes" />
        <div className="text-red-600">Error al cargar reportes</div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-slide-up">
      <PageHeader
        title="Reportes"
        description="Análisis de gastos por centro de costos"
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
        <Field className="sm:w-auto">
          <FieldLabel>Proyecto</FieldLabel>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue placeholder="Proyecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="sm:w-auto">
          <FieldLabel htmlFor="report-date-from">Desde</FieldLabel>
          <Input
            id="report-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="sm:w-[160px]"
          />
        </Field>
        <Field className="sm:w-auto">
          <FieldLabel htmlFor="report-date-to">Hasta</FieldLabel>
          <Input
            id="report-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="sm:w-[160px]"
          />
        </Field>
      </div>

      {isLoadingReport && <LoadingTable rows={6} />}

      {!isLoadingReport && reportData && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mb-6">
            <KPICard title="Total Gastado" value={formatCurrency(totalSpend)} icon={DollarSign} />
            <KPICard title="Comprobantes" value={totalReceipts} icon={Receipt} />
            <KPICard
              title="Mayor Gasto"
              value={topCostCenter?.cost_center_name ?? '—'}
              icon={TrendingUp}
              description={topCostCenter ? formatCurrency(topCostCenter.total_amount) : undefined}
            />
          </div>

          {reportData.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Sin datos"
              description="No hay comprobantes confirmados para los filtros seleccionados"
            />
          ) : (
            <>
              {/* Chart */}
              <div className="mb-6">
                <SpendByCostCenterChart data={reportData} />
              </div>

              {/* Summary Table with Drill-down */}
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Centro de Costos</TableHead>
                        <TableHead className="text-right">Comprobantes</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((row) => {
                        const isExpanded = expandedCostCenter === row.cost_center_id;
                        const pct = totalSpend > 0
                          ? ((row.total_amount / totalSpend) * 100).toFixed(1)
                          : '0.0';

                        return (
                          <>
                            <TableRow
                              key={row.cost_center_id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleToggleCostCenter(row.cost_center_id)}
                            >
                              <TableCell>
                                {isExpanded
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  style={
                                    row.cost_center_color && COST_CENTER_BADGE_STYLES[row.cost_center_color as keyof typeof COST_CENTER_BADGE_STYLES]
                                      ? {
                                          backgroundColor: COST_CENTER_BADGE_STYLES[row.cost_center_color as keyof typeof COST_CENTER_BADGE_STYLES].bg,
                                          color: COST_CENTER_BADGE_STYLES[row.cost_center_color as keyof typeof COST_CENTER_BADGE_STYLES].text,
                                        }
                                      : undefined
                                  }
                                >
                                  {row.cost_center_name}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{row.receipt_count}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(row.total_amount)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {pct}%
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${row.cost_center_id}-detail`}>
                                <TableCell colSpan={5} className="p-0">
                                  <div className="bg-muted/30 p-4">
                                    {isLoadingDrilldown ? (
                                      <LoadingTable rows={3} />
                                    ) : filteredDrilldown.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">
                                        No hay comprobantes para este centro de costos
                                      </p>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Proveedor</TableHead>
                                            <TableHead>Proyecto</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                            <TableHead>Estado</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {filteredDrilldown.map((receipt) => (
                                            <TableRow
                                              key={receipt.id}
                                              className="cursor-pointer"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/receipts/${receipt.id}`);
                                              }}
                                            >
                                              <TableCell>{receipt.vendor ?? 'Sin proveedor'}</TableCell>
                                              <TableCell>{receipt.project?.name ?? '—'}</TableCell>
                                              <TableCell>
                                                {new Date(receipt.receipt_date).toLocaleDateString('es-AR')}
                                              </TableCell>
                                              <TableCell className="text-right font-semibold">
                                                {formatCurrency(receipt.total_amount)}
                                              </TableCell>
                                              <TableCell>
                                                <StatusBadge status={receipt.status} />
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/reports/page.tsx
git commit -m "feat: add reports page with chart, table, and drill-down"
```

---

### Task 5: Update sidebar with role-based nav filtering

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

**Context:**
- Import `BarChart3` from `lucide-react` (add to existing import)
- Import `useCurrentUser` is already imported (line 8)
- Add optional `roles` field to nav items
- Filter `visibleNavItems` by user role
- Add Reportes item before Ajustes

**Step 1: Add the roles field and filter logic**

Add `roles?: string[]` to the nav item type. Change `navItems` to include the new Reportes entry. Filter visible items by role.

Replace the entire nav items + `visibleNavItems` section:

```tsx
// Change import line 5 to add BarChart3:
import { LayoutDashboard, FolderKanban, Receipt, Upload, BarChart3, Settings } from 'lucide-react';

// Replace lines 12-24 with:
const navItems: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}> = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/receipts', label: 'Comprobantes', icon: Receipt },
  { href: '/upload', label: 'Cargar', icon: Upload },
  { href: '/reports', label: 'Reportes', icon: BarChart3, roles: ['admin', 'supervisor'] },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

// In the Sidebar component, replace line 24:
const visibleNavItems = navItems.filter(
  (item) => !item.roles || item.roles.includes(role)
);
```

**Step 2: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat: add reports link to sidebar with role-based filtering"
```

---

### Task 6: Add `cost_center_id` filter support to receipts API

**Files:**
- Modify: `apps/web/app/api/receipts/route.ts`

**Context:**
- The drill-down in the reports page fetches `/api/receipts?cost_center_id=xxx&status=confirmed`
- The receipts GET handler already supports `project_id` and `status` filters
- Need to add `cost_center_id` filter

**Step 1: Add the filter**

In `apps/web/app/api/receipts/route.ts`, after line 25 (`if (status) query = query.eq('status', status);`), add:

```ts
const costCenterId = searchParams.get('cost_center_id');
// ...existing filters...
if (costCenterId) query = query.eq('cost_center_id', costCenterId);
```

**Step 2: Verify build**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/api/receipts/route.ts
git commit -m "feat: add cost_center_id filter to receipts GET endpoint"
```

---

### Task 7: Final verification

**Step 1: Full type check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 2: Build check**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Commit any fixes if needed**

If build revealed issues, fix them and commit:
```bash
git add -A
git commit -m "fix: address build issues in reports feature"
```
