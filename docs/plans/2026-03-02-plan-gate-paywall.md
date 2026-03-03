# Plan Gate Paywall Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a non-dismissible upgrade dialog over a blurred skeleton preview when free-plan users navigate to Administration or Reports views, with a lock icon in the sidebar.

**Architecture:** A reusable `PlanGatePage` client component wraps each gated page. It uses `usePlan()` to detect free plan. If free, it renders children (skeletons) behind a blur + a Shadcn Dialog that can't be closed. The sidebar stops hiding these nav items for free users and instead shows a lock icon.

**Tech Stack:** React 19, Shadcn Dialog (Radix), Lucide icons, Tailwind CSS, `usePlan()` hook

---

### Task 1: Create `PlanGatePage` component

**Files:**
- Create: `apps/web/components/plan-gate-page.tsx`

**Step 1: Create the component file**

```tsx
'use client';

import Link from 'next/link';
import { Sparkles, Check, ArrowLeft } from 'lucide-react';
import { usePlan } from '@/lib/use-plan';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface PlanGatePageProps {
  title: string;
  description: string;
  features: string[];
  children: React.ReactNode;
}

export function PlanGatePage({
  title,
  description,
  features,
  children,
}: PlanGatePageProps) {
  const { isFreePlan, isLoading } = usePlan();

  // While loading, show children (skeletons) without blur or dialog
  if (isLoading || !isFreePlan) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred skeleton background */}
      <div className="blur-sm opacity-50 pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      {/* Non-dismissible upgrade dialog */}
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">
              Desbloqueá {title}
            </DialogTitle>
            <DialogDescription>
              {description}
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-3 py-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button asChild className="w-full">
              <Link href="/settings/billing">Ver planes</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al panel
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `plan-gate-page.tsx`

**Step 3: Commit**

```bash
git add apps/web/components/plan-gate-page.tsx
git commit -m "feat: add PlanGatePage component for free plan upgrade paywall"
```

---

### Task 2: Integrate `PlanGatePage` into Administration page

**Files:**
- Modify: `apps/web/app/(dashboard)/administration/page.tsx`

**Step 1: Wrap page content with PlanGatePage**

The current page is a single `'use client'` component that fetches data and renders KPIs, charts, and tables. We need to:

1. Import `PlanGatePage` and `usePlan`
2. Add the `usePlan()` call to check `isFreePlan`
3. If free → render `PlanGatePage` with static skeletons instead of fetching data
4. If paid → render current content as-is

Replace the entire file with:

```tsx
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { formatCurrency } from '@/lib/format';
import { usePlan } from '@/lib/use-plan';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingCards, LoadingTable } from '@/components/ui/loading-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CashflowChart } from '@/components/administration/cashflow-chart';
import { BalanceByProjectTable } from '@/components/administration/balance-by-project-table';
import { VsBudgetTable } from '@/components/administration/vs-budget-table';
import { PlanGatePage } from '@/components/plan-gate-page';
import { Skeleton } from '@/components/ui/skeleton';

function AdministrationSkeleton() {
  return (
    <div className="space-y-6">
      {/* Fake filter bar */}
      <div className="-mx-4 md:-mx-8 -mt-2 px-4 md:px-8 pb-5 mb-2 border-b border-border bg-card">
        <div className="flex gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-[250px]" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
        </div>
      </div>
      {/* KPI cards */}
      <LoadingCards count={3} />
      {/* Chart area */}
      <div className="rounded-lg border p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[250px] w-full" />
      </div>
      {/* Table */}
      <LoadingTable rows={5} />
    </div>
  );
}

export default function AdministrationPage() {
  const { isFreePlan, isLoading: isPlanLoading } = usePlan();

  if (isPlanLoading) {
    return <AdministrationSkeleton />;
  }

  if (isFreePlan) {
    return (
      <PlanGatePage
        title="Administración"
        description="Controlá el flujo financiero de todos tus proyectos."
        features={[
          'Flujo de caja mensual (ingresos vs egresos)',
          'Balance por proyecto',
          'Presupuestado vs ejecutado por rubro',
          'Gestión de ingresos y egresos',
        ]}
      >
        <AdministrationSkeleton />
      </PlanGatePage>
    );
  }

  return <AdministrationContent />;
}

function AdministrationContent() {
  const currentYear = new Date().getFullYear();
  const [projectId, setProjectId] = useState<string>('all');
  const [year, setYear] = useState<string>(currentYear.toString());

  // Fetch projects for filter
  const { data: projects } = useSWR<Array<{ id: string; name: string }>>('/api/projects', fetcher);

  // Build query params
  const params = new URLSearchParams();
  if (projectId !== 'all') params.set('projectId', projectId);
  params.set('year', year);
  const queryString = params.toString();

  // Fetch summary data
  const { data: summary, isLoading: isLoadingSummary, error: summaryError } = useSWR(
    `/api/administration/summary?${queryString}`,
    fetcher
  );

  // Fetch cashflow data
  const { data: cashflow, isLoading: isLoadingCashflow, error: cashflowError } = useSWR(
    `/api/administration/cashflow?${queryString}`,
    fetcher
  );

  // Fetch vs-budget only when a specific project is selected
  const { data: vsBudget } = useSWR(
    projectId !== 'all' ? `/api/administration/vs-budget?projectId=${projectId}` : null,
    fetcher
  );

  // Year options (current year and 2 previous)
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="-mx-4 md:-mx-8 -mt-2 px-4 md:px-8 pb-5 mb-2 border-b border-border bg-card">
        <div className="flex gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Proyecto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Todos los proyectos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Periodo</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error */}
      {(summaryError || cashflowError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          Error al cargar los datos de administracion. Intenta recargar la pagina.
        </div>
      )}

      {/* KPIs */}
      {isLoadingSummary ? (
        <LoadingCards count={3} />
      ) : summary ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <StatCard
            title="Total Ingresado"
            value={formatCurrency(summary.totalIncome)}
            icon={TrendingUp}
            iconBg="bg-green-50 dark:bg-green-900/20"
            iconColor="text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Total Egresado"
            value={formatCurrency(summary.totalExpense)}
            icon={TrendingDown}
            iconBg="bg-red-50 dark:bg-red-900/20"
            iconColor="text-red-600 dark:text-red-400"
          />
          <StatCard
            title="Balance"
            value={formatCurrency(summary.balance)}
            icon={DollarSign}
            iconBg={summary.balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'}
            iconColor={summary.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}
          />
        </div>
      ) : null}

      {/* Cashflow Chart */}
      {isLoadingCashflow ? (
        <LoadingCards count={1} />
      ) : cashflow ? (
        <CashflowChart data={cashflow} />
      ) : null}

      {/* vs-budget section (only when specific project selected) */}
      {projectId !== 'all' && vsBudget?.hasPublishedBudget && (
        <VsBudgetTable
          rubros={vsBudget.rubros}
          totalBudgeted={vsBudget.totalBudgeted}
          totalCost={vsBudget.totalCost}
          totalActual={vsBudget.totalActual}
          totalDifference={vsBudget.totalDifference}
          globalPercentage={vsBudget.globalPercentage}
        />
      )}

      {/* Balance by project table (only when "all" selected) */}
      {projectId === 'all' && summary?.byProject && (
        <BalanceByProjectTable data={summary.byProject} />
      )}
    </div>
  );
}
```

Key changes:
- Import `PlanGatePage`, `usePlan`, `Skeleton`
- Extract `AdministrationSkeleton` as a static skeleton that mirrors the page layout
- Extract `AdministrationContent` with all the original page logic (data fetching, rendering)
- `AdministrationPage` is now a thin router: loading → skeleton, free → gate, paid → content
- Free users never trigger API calls (SWR hooks are in `AdministrationContent` which doesn't mount)

**Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/administration/page.tsx
git commit -m "feat: add plan gate paywall to administration page"
```

---

### Task 3: Integrate `PlanGatePage` into Reports page

**Files:**
- Modify: `apps/web/app/(dashboard)/reports/page.tsx`

**Step 1: Add plan gate with skeleton**

Same pattern as Task 2. Add imports and wrap with early return. The reports page already has a header band, KPI cards, filters, chart, and table — the skeleton mimics that structure.

At the top of the file, after existing imports, add:

```tsx
import { usePlan } from '@/lib/use-plan';
import { PlanGatePage } from '@/components/plan-gate-page';
import { Skeleton } from '@/components/ui/skeleton';
```

Add a `ReportsSkeleton` component before the `ReportsPage` function:

```tsx
function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Fake header band */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card space-y-5">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full sm:w-[250px]" />
          </div>
          <div className="flex gap-4">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full sm:w-[160px]" />
            </div>
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full sm:w-[160px]" />
            </div>
          </div>
        </div>
      </div>
      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>
      {/* Chart area */}
      <div className="rounded-lg border p-6">
        <Skeleton className="h-[200px] w-full" />
      </div>
      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="p-3 flex gap-4 border-b">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24 ml-auto" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3 flex gap-4 border-b">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Rename the existing `ReportsPage` function to `ReportsContent`, and create a new `ReportsPage` as the thin router:

```tsx
export default function ReportsPage() {
  const { isFreePlan, isLoading: isPlanLoading } = usePlan();

  if (isPlanLoading) {
    return <ReportsSkeleton />;
  }

  if (isFreePlan) {
    return (
      <PlanGatePage
        title="Reportes"
        description="Analizá tus gastos con reportes detallados."
        features={[
          'Análisis de gastos por rubro',
          'Filtros por fecha y proyecto',
          'Desglose detallado por comprobante',
        ]}
      >
        <ReportsSkeleton />
      </PlanGatePage>
    );
  }

  return <ReportsContent />;
}
```

Move all the original `ReportsPage` logic into `function ReportsContent()` (NOT exported, same file).

**Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/reports/page.tsx
git commit -m "feat: add plan gate paywall to reports page"
```

---

### Task 4: Update sidebar to show gated items with lock icon

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

**Step 1: Add Lock import and update filtering logic**

In `sidebar.tsx`, make these changes:

1. Add `Lock` to the Lucide import (line 5):

Change:
```tsx
import { LayoutDashboard, FolderKanban, Sparkles, Calculator, BarChart3, Landmark, Settings } from 'lucide-react';
```
To:
```tsx
import { LayoutDashboard, FolderKanban, Sparkles, Calculator, BarChart3, Landmark, Settings, Lock } from 'lucide-react';
```

2. Remove the Reports filter for free plan (lines 40-44). Change:

```tsx
  const visibleNavItems = navItems.filter((item) => {
    if (item.href === '/reports' && isFreePlan) return false;
    if (item.roles && !item.roles.includes(role)) return false;
    return true;
  });
```

To:

```tsx
  const visibleNavItems = navItems.filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    return true;
  });

  const isGatedItem = (href: string) =>
    isFreePlan && (href === '/administration' || href === '/reports');
```

3. Add the lock icon inside the nav link, after the label (inside the `<Link>` element, lines 64-67). Change:

```tsx
            <item.icon className="h-4 w-4" />
            {item.label}
```

To:

```tsx
            <item.icon className="h-4 w-4" />
            {item.label}
            {isGatedItem(item.href) && (
              <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground/60" />
            )}
```

**Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat: show gated nav items with lock icon for free plan users"
```

---

### Task 5: Build and verify

**Step 1: Run full build**

Run: `cd /path/to/worktree && npm run build`
Expected: Build succeeds with no errors

**Step 2: Verify visually (manual)**

- Open browser as free plan user
- Sidebar should show Administration and Reports with lock icon
- Navigate to /administration → blurred skeleton + upgrade dialog
- Navigate to /reports → blurred skeleton + upgrade dialog
- Dialog has "Ver planes" → navigates to /settings/billing
- Dialog has "Volver al panel" → navigates to /
- Dialog cannot be dismissed (no X, no Escape, no outside click)

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address paywall visual issues"
```
