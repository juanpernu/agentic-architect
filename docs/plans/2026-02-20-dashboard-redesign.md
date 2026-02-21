# Dashboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the dashboard page with a mobile-first, branded UI using reusable components that extend shadcn.

**Architecture:** Extend the existing shadcn theme with new design tokens (shadow-soft). Create 4 new reusable components (StatCard, ProgressBarList, BarChartSimple, DashboardGreeting). Modify 3 existing dashboard components to use the new components. No changes to data fetching logic except adding previous-month spend comparison.

**Tech Stack:** Next.js 15, React 19, Tailwind v4, shadcn, Clerk (`useOrganization`, `useUser`), lucide-react

---

### Task 1: Add design tokens

**Files:**
- Modify: `apps/web/app/globals.css`

**Step 1: Add shadow-soft token to @theme block**

In `apps/web/app/globals.css`, add inside the `@theme inline { ... }` block, after the existing radius variables:

```css
  --shadow-soft: 0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04);
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat: add shadow-soft design token for dashboard redesign"
```

---

### Task 2: Create StatCard component

**Files:**
- Create: `apps/web/components/ui/stat-card.tsx`

**Step 1: Create the component**

```tsx
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatBadge {
  label: string;
  variant: 'positive' | 'negative';
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  badge?: StatBadge;
  pulse?: boolean;
}

const badgeStyles = {
  positive: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
  negative: 'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
};

export function StatCard({ title, value, icon: Icon, iconBg, iconColor, badge, pulse }: StatCardProps) {
  return (
    <Card className="relative h-32 overflow-hidden border border-border/50 p-4 shadow-soft hover:scale-[1.02] transition-transform flex flex-col justify-between gap-0">
      <div className="flex justify-between items-start">
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        {badge && (
          <span className={cn('text-xs font-semibold flex items-center px-1.5 py-0.5 rounded', badgeStyles[badge.variant])}>
            {badge.label}
          </span>
        )}
        {pulse && (
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        )}
      </div>
      <div>
        <h3 className="text-2xl font-bold truncate" title={String(value)}>{value}</h3>
        <p className="text-xs text-muted-foreground mt-1">{title}</p>
      </div>
    </Card>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/components/ui/stat-card.tsx
git commit -m "feat: add StatCard reusable component"
```

---

### Task 3: Create ProgressBarList component

**Files:**
- Create: `apps/web/components/ui/progress-bar-list.tsx`

**Step 1: Create the component**

```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ProgressBarItem {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
}

interface ProgressBarListProps {
  title: string;
  items: ProgressBarItem[];
  maxItems?: number;
  actionLabel?: string;
  actionHref?: string;
  emptyMessage?: string;
}

const BAR_COLORS = [
  'bg-primary',
  'bg-blue-400',
  'bg-blue-300',
  'bg-blue-200',
  'bg-blue-100',
];

export function ProgressBarList({
  title,
  items,
  maxItems = 5,
  actionLabel,
  actionHref,
  emptyMessage = 'No hay datos disponibles',
}: ProgressBarListProps) {
  const visibleItems = items.slice(0, maxItems);
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
    return (
      <Card className="shadow-soft border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-bold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        {actionLabel && actionHref && (
          <CardAction>
            <Link href={actionHref} className="text-xs text-primary font-medium hover:underline">
              {actionLabel}
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleItems.map((item, index) => {
            const widthPercent = (item.value / maxValue) * 100;
            return (
              <div key={item.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium truncate mr-2">{item.label}</span>
                  <span className="font-bold shrink-0">{item.formattedValue}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all', BAR_COLORS[index] ?? BAR_COLORS[BAR_COLORS.length - 1])}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/components/ui/progress-bar-list.tsx
git commit -m "feat: add ProgressBarList reusable component"
```

---

### Task 4: Create BarChartSimple component

**Files:**
- Create: `apps/web/components/ui/bar-chart-simple.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BarChartItem {
  label: string;
  value: number;
  formattedValue?: string;
}

interface BarChartSimpleProps {
  title: string;
  data: BarChartItem[];
  legend?: string;
  highlightLast?: boolean;
  emptyMessage?: string;
}

const BAR_GRADIENT = [
  'bg-blue-100 dark:bg-blue-900/30',
  'bg-blue-200 dark:bg-blue-800/40',
  'bg-blue-300 dark:bg-blue-700/50',
  'bg-blue-400 dark:bg-blue-600/60',
  'bg-blue-500 dark:bg-blue-500/70',
];

export function BarChartSimple({
  title,
  data,
  legend,
  highlightLast = true,
  emptyMessage = 'No hay datos disponibles',
}: BarChartSimpleProps) {
  if (data.length === 0) {
    return (
      <Card className="shadow-soft border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-bold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card className="shadow-soft border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        {legend && (
          <CardAction>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">{legend}</span>
            </div>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-40 flex items-end justify-between gap-2 pt-4 px-2 relative">
          {/* Dashed grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-t border-dashed border-border h-0 w-full" />
            ))}
          </div>

          {/* Bars */}
          {data.map((item, index) => {
            const heightPercent = (item.value / maxValue) * 100;
            const isLast = index === data.length - 1;
            const gradientIndex = data.length <= BAR_GRADIENT.length
              ? index
              : Math.floor((index / (data.length - 1)) * (BAR_GRADIENT.length - 1));
            const barColor = isLast && highlightLast
              ? 'bg-primary'
              : BAR_GRADIENT[gradientIndex] ?? BAR_GRADIENT[BAR_GRADIENT.length - 1];

            return (
              <div
                key={item.label}
                className={cn(
                  'flex-1 rounded-t-sm relative group z-10 transition-all',
                  barColor,
                  isLast && highlightLast && 'shadow-lg shadow-primary/30'
                )}
                style={{ height: `${heightPercent}%` }}
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {item.formattedValue ?? item.label}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/components/ui/bar-chart-simple.tsx
git commit -m "feat: add BarChartSimple reusable CSS chart component"
```

---

### Task 5: Create DashboardGreeting component

**Files:**
- Create: `apps/web/components/dashboard/dashboard-greeting.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { useOrganization } from '@clerk/nextjs';
import { useCurrentUser } from '@/lib/use-current-user';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardGreeting() {
  const { fullName, isLoaded: isUserLoaded } = useCurrentUser();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();

  if (!isUserLoaded || !isOrgLoaded) {
    return (
      <div className="space-y-2 mb-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-56" />
      </div>
    );
  }

  const firstName = fullName.split(' ')[0] || 'Usuario';
  const orgName = organization?.name ?? '';

  return (
    <div className="mb-6">
      {orgName && (
        <p className="text-sm font-medium text-muted-foreground">{orgName}</p>
      )}
      <h1 className="text-2xl font-bold mt-0.5">
        Hola, {firstName}!
      </h1>
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/components/dashboard/dashboard-greeting.tsx
git commit -m "feat: add DashboardGreeting with dynamic user and org name"
```

---

### Task 6: Extend fetchStats and update DashboardKPIs

**Files:**
- Modify: `packages/shared/src/types.ts` (DashboardStats interface)
- Modify: `apps/web/components/dashboard/dashboard-kpis.tsx`

**Step 1: Extend DashboardStats type**

In `packages/shared/src/types.ts`, update the `DashboardStats` interface:

```ts
export interface DashboardStats {
  active_projects: number;
  monthly_spend: number;
  weekly_receipts: number;
  pending_review: number;
  new_projects_this_week: number;
  previous_month_spend: number;
}
```

**Step 2: Update dashboard-kpis.tsx**

Replace the entire file `apps/web/components/dashboard/dashboard-kpis.tsx` with:

```tsx
import { Building2, DollarSign, Receipt, Clock } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { formatCurrencyCompact } from '@/lib/format';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import type { DashboardStats } from '@architech/shared';

async function fetchStats(): Promise<DashboardStats | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const db = getDb();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const startOfWeek = weekStart.toISOString();

  const architectFilter = ctx.role === 'architect' ? ctx.dbUserId : null;

  let projectsQuery = db.from('projects').select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId).eq('status', 'active');
  if (architectFilter) projectsQuery = projectsQuery.eq('architect_id', architectFilter);

  let newProjectsQuery = db.from('projects').select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId).eq('status', 'active')
    .gte('created_at', startOfWeek);
  if (architectFilter) newProjectsQuery = newProjectsQuery.eq('architect_id', architectFilter);

  let monthlySpendQuery = db.from('receipts').select('total_amount, projects!inner(organization_id, architect_id)')
    .eq('projects.organization_id', ctx.orgId)
    .eq('status', 'confirmed')
    .gte('receipt_date', startOfMonth);
  if (architectFilter) monthlySpendQuery = monthlySpendQuery.eq('projects.architect_id', architectFilter);

  let prevMonthSpendQuery = db.from('receipts').select('total_amount, projects!inner(organization_id, architect_id)')
    .eq('projects.organization_id', ctx.orgId)
    .eq('status', 'confirmed')
    .gte('receipt_date', startOfPrevMonth)
    .lte('receipt_date', endOfPrevMonth);
  if (architectFilter) prevMonthSpendQuery = prevMonthSpendQuery.eq('projects.architect_id', architectFilter);

  let weeklyReceiptsQuery = db.from('receipts').select('id, projects!inner(organization_id, architect_id)', { count: 'exact', head: true })
    .eq('projects.organization_id', ctx.orgId)
    .gte('created_at', startOfWeek);
  if (architectFilter) weeklyReceiptsQuery = weeklyReceiptsQuery.eq('projects.architect_id', architectFilter);

  let pendingReviewQuery = db.from('receipts').select('id, projects!inner(organization_id, architect_id)', { count: 'exact', head: true })
    .eq('projects.organization_id', ctx.orgId)
    .eq('status', 'pending');
  if (architectFilter) pendingReviewQuery = pendingReviewQuery.eq('projects.architect_id', architectFilter);

  const [projects, newProjects, monthlySpend, prevMonthSpend, weeklyReceipts, pendingReview] = await Promise.all([
    projectsQuery, newProjectsQuery, monthlySpendQuery, prevMonthSpendQuery, weeklyReceiptsQuery, pendingReviewQuery,
  ]);

  const totalMonthlySpend = (monthlySpend.data ?? [])
    .reduce((sum, r) => sum + Number(r.total_amount), 0);

  const totalPrevMonthSpend = (prevMonthSpend.data ?? [])
    .reduce((sum, r) => sum + Number(r.total_amount), 0);

  return {
    active_projects: projects.count ?? 0,
    monthly_spend: totalMonthlySpend,
    weekly_receipts: weeklyReceipts.count ?? 0,
    pending_review: pendingReview.count ?? 0,
    new_projects_this_week: newProjects.count ?? 0,
    previous_month_spend: totalPrevMonthSpend,
  };
}

function getSpendBadge(current: number, previous: number): { label: string; variant: 'positive' | 'negative' } | undefined {
  if (previous === 0) return undefined;
  const pctChange = Math.round(((current - previous) / previous) * 100);
  if (pctChange === 0) return undefined;
  const arrow = pctChange > 0 ? '\u2191' : '\u2193';
  return {
    label: `${arrow} ${Math.abs(pctChange)}%`,
    variant: pctChange > 0 ? 'negative' : 'positive',
  };
}

export async function DashboardKPIs() {
  const data = await fetchStats();

  if (!data) {
    return (
      <div className="text-sm text-muted-foreground">
        Error cargando estadisticas
      </div>
    );
  }

  const spendBadge = getSpendBadge(data.monthly_spend, data.previous_month_spend);
  const projectsBadge = data.new_projects_this_week > 0
    ? { label: `+${data.new_projects_this_week}`, variant: 'positive' as const }
    : undefined;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Proyectos Activos"
        value={data.active_projects}
        icon={Building2}
        iconBg="bg-blue-50 dark:bg-blue-900/20"
        iconColor="text-blue-600 dark:text-blue-400"
        badge={projectsBadge}
      />
      <StatCard
        title="Gasto Mensual"
        value={formatCurrencyCompact(data.monthly_spend)}
        icon={DollarSign}
        iconBg="bg-emerald-50 dark:bg-emerald-900/20"
        iconColor="text-emerald-600 dark:text-emerald-400"
        badge={spendBadge}
      />
      <StatCard
        title="Comprobantes (Sem)"
        value={data.weekly_receipts}
        icon={Receipt}
        iconBg="bg-purple-50 dark:bg-purple-900/20"
        iconColor="text-purple-600 dark:text-purple-400"
      />
      <StatCard
        title="Pendientes Review"
        value={data.pending_review}
        icon={Clock}
        iconBg="bg-amber-50 dark:bg-amber-900/20"
        iconColor="text-amber-600 dark:text-amber-400"
        pulse={data.pending_review > 0}
      />
    </div>
  );
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts apps/web/components/dashboard/dashboard-kpis.tsx
git commit -m "feat: update DashboardKPIs to use StatCard with dynamic badges"
```

---

### Task 7: Update RecentReceipts with new layout

**Files:**
- Modify: `apps/web/components/dashboard/recent-receipts.tsx`

**Step 1: Replace the component**

Replace entire file with:

```tsx
import Link from 'next/link';
import { ArrowRight, Receipt as ReceiptIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import type { ReceiptStatus } from '@architech/shared';

interface RecentReceipt {
  id: string;
  vendor: string | null;
  total_amount: number;
  receipt_date: string;
  created_at: string;
  status: ReceiptStatus;
  project: { id: string; name: string };
}

async function fetchRecentReceipts(): Promise<RecentReceipt[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const db = getDb();

  let query = db
    .from('receipts')
    .select('id, vendor, total_amount, receipt_date, created_at, status, project:projects!project_id(id, name)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (ctx.role === 'architect') {
    query = query.eq('uploaded_by', ctx.dbUserId);
  }

  const { data } = await query;
  return (data as unknown as RecentReceipt[]) ?? [];
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  processing: 'Procesando',
  rejected: 'Rechazado',
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const receiptDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  if (receiptDay.getTime() === today.getTime()) {
    return `Hoy, ${time}`;
  }
  if (receiptDay.getTime() === yesterday.getTime()) {
    return `Ayer, ${time}`;
  }
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export async function RecentReceipts() {
  const receipts = await fetchRecentReceipts();

  if (receipts.length === 0) {
    return (
      <section>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="font-bold text-lg">Comprobantes Recientes</h3>
        </div>
        <Card className="shadow-soft border-border/50 p-6">
          <p className="text-sm text-muted-foreground">No hay comprobantes disponibles</p>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <div className="flex justify-between items-center mb-4 px-1">
        <h3 className="font-bold text-lg">Comprobantes Recientes</h3>
        <Link href="/receipts" className="text-sm text-primary font-medium hover:underline">
          Ver Todos
        </Link>
      </div>
      <Card className="shadow-soft border-border/50 overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <Link
                href={`/receipts/${receipt.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{receipt.vendor || 'Sin proveedor'}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeDate(receipt.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{formatCurrency(receipt.total_amount)}</p>
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium mt-1',
                    STATUS_STYLES[receipt.status] ?? STATUS_STYLES.pending
                  )}>
                    {STATUS_LABELS[receipt.status] ?? receipt.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <div className="bg-muted/30 p-3 text-center border-t">
          <Link
            href="/receipts"
            className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
          >
            Ver historial completo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/components/dashboard/recent-receipts.tsx
git commit -m "feat: redesign RecentReceipts with avatar icons and relative dates"
```

---

### Task 8: Wire up SpendByProject and SpendTrend to new components

**Files:**
- Modify: `apps/web/app/(dashboard)/page.tsx`

**Step 1: Replace the page**

Replace entire file with:

```tsx
import { Suspense } from 'react';
import { DashboardGreeting } from '@/components/dashboard/dashboard-greeting';
import { DashboardKPIs } from '@/components/dashboard/dashboard-kpis';
import { RecentReceipts } from '@/components/dashboard/recent-receipts';
import { ProgressBarList } from '@/components/ui/progress-bar-list';
import { BarChartSimple } from '@/components/ui/bar-chart-simple';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { formatCurrencyCompact } from '@/lib/format';
import type { SpendByProject, SpendTrend } from '@architech/shared';

const monthLabels: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

async function fetchSpendByProject(): Promise<SpendByProject[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const db = getDb();

  let query = db
    .from('projects')
    .select('id, name, receipts!inner(total_amount, status)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'active')
    .eq('receipts.status', 'confirmed');

  if (ctx.role === 'architect') {
    query = query.eq('architect_id', ctx.dbUserId);
  }

  const { data } = await query;

  return (data ?? [])
    .map((p) => ({
      project_id: p.id,
      project_name: p.name,
      total_spend: (p.receipts as Array<{ total_amount: number; status: string }>)
        ?.reduce((sum: number, r) => sum + Number(r.total_amount), 0) ?? 0,
    }))
    .sort((a, b) => b.total_spend - a.total_spend);
}

async function fetchSpendTrend(): Promise<SpendTrend[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const db = getDb();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  let query = db
    .from('receipts')
    .select('total_amount, receipt_date, projects!inner(organization_id, architect_id)')
    .eq('projects.organization_id', ctx.orgId)
    .eq('status', 'confirmed')
    .gte('receipt_date', sixMonthsAgo.toISOString().split('T')[0]);

  if (ctx.role === 'architect') {
    query = query.eq('projects.architect_id', ctx.dbUserId);
  }

  const { data } = await query;

  const monthMap = new Map<string, number>();
  for (const receipt of data ?? []) {
    const month = receipt.receipt_date.substring(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + Number(receipt.total_amount));
  }

  return Array.from(monthMap.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function SpendByProjectSection() {
  const data = await fetchSpendByProject();
  return (
    <ProgressBarList
      title="Gasto por Proyecto"
      items={data.map((p) => ({
        id: p.project_id,
        label: p.project_name,
        value: p.total_spend,
        formattedValue: formatCurrencyCompact(p.total_spend),
      }))}
      maxItems={5}
      actionLabel="Ver Todo"
      actionHref="/projects"
    />
  );
}

async function SpendTrendSection() {
  const data = await fetchSpendTrend();
  return (
    <BarChartSimple
      title="Tendencia Mensual"
      data={data.map((item) => {
        const [, monthNum] = item.month.split('-');
        return {
          label: monthLabels[monthNum] || item.month,
          value: item.total,
          formattedValue: `${monthLabels[monthNum] || item.month}: ${formatCurrencyCompact(item.total)}`,
        };
      })}
      legend="Actual"
      highlightLast
    />
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-slide-up">
      <DashboardGreeting />

      {/* KPIs Section */}
      <Suspense
        fallback={
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 stagger-children">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-32 p-4 shadow-soft border-border/50">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-1/2 mt-auto" />
              </Card>
            ))}
          </div>
        }
      >
        <DashboardKPIs />
      </Suspense>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 stagger-children">
        <Suspense
          fallback={
            <Card className="shadow-soft border-border/50 p-6">
              <Skeleton className="h-4 w-40 mb-4" />
              <div className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            </Card>
          }
        >
          <SpendByProjectSection />
        </Suspense>

        <Suspense
          fallback={
            <Card className="shadow-soft border-border/50 p-6">
              <Skeleton className="h-4 w-40 mb-4" />
              <Skeleton className="h-40 w-full" />
            </Card>
          }
        >
          <SpendTrendSection />
        </Suspense>
      </div>

      {/* Recent Receipts Section */}
      <Suspense
        fallback={
          <div>
            <Skeleton className="h-6 w-52 mb-4" />
            <Card className="shadow-soft border-border/50 p-0">
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        }
      >
        <RecentReceipts />
      </Suspense>
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add "apps/web/app/(dashboard)/page.tsx"
git commit -m "feat: wire up dashboard page with redesigned components"
```

---

### Task 9: Final verification

**Step 1: Type check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

**Step 2: Build check**

Run: `npm run build --workspace=apps/web`
Expected: Build succeeds

**Step 3: Visual verification**

Run dev server and check:
- [ ] Mobile (375px): 2x2 stat cards, stacked sections, proper spacing
- [ ] Desktop (1280px): 4-col stat cards, side-by-side charts, full-width receipts
- [ ] Greeting shows real user name and org name
- [ ] Stat badges show dynamic values (+N, %)
- [ ] Progress bars proportional to data
- [ ] Trend bars proportional to data with hover tooltips
- [ ] Recent receipts show relative dates ("Hoy", "Ayer")
- [ ] Status badges colored correctly

**Step 4: Commit any fixes**

If any visual tweaks are needed, fix and commit.
