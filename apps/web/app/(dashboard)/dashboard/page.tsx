import { Suspense } from 'react';
import { DashboardGreeting } from '@/components/dashboard/dashboard-greeting';
import { DashboardKPIs } from '@/components/dashboard/dashboard-kpis';
import { RecentReceipts } from '@/components/dashboard/recent-receipts';
import { ProgressBarList } from '@/components/ui/progress-bar-list';
import { SpendTrendChart } from '@/components/dashboard/spend-trend-chart';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { formatCurrencyCompact } from '@/lib/format';
import type { SpendByProject } from '@architech/shared';

async function fetchSpendByProject(): Promise<SpendByProject[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];

  const db = getDb();

  let query = db
    .from('projects')
    .select('id, name, expenses!inner(amount)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'active');

  if (ctx.role === 'architect') {
    query = query.eq('architect_id', ctx.dbUserId);
  }

  const { data } = await query;

  return (data ?? [])
    .map((p) => ({
      project_id: p.id,
      project_name: p.name,
      total_spend: (p.expenses as Array<{ amount: number }>)
        ?.reduce((sum: number, e) => sum + Number(e.amount), 0) ?? 0,
    }))
    .sort((a, b) => b.total_spend - a.total_spend);
}

async function SpendByProjectSection() {
  const data = await fetchSpendByProject();
  return (
    <ProgressBarList
      title="Gasto por Proyecto"
      description="Distribución de costos acumulados este año."
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

function KPISkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6 flex flex-col gap-2">
          <div className="flex justify-between items-center pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded" />
          </div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="p-6 pb-4 border-b border-border/50">
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="p-6">
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

function ReceiptsSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="p-6 pb-4 border-b border-border/50">
        <Skeleton className="h-5 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      {/* Header */}
      <DashboardGreeting />

      {/* KPI Cards */}
      <Suspense fallback={<KPISkeleton />}>
        <DashboardKPIs />
      </Suspense>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton />}>
          <SpendByProjectSection />
        </Suspense>
        <SpendTrendChart />
      </div>

      {/* Recent Receipts */}
      <Suspense fallback={<ReceiptsSkeleton />}>
        <RecentReceipts />
      </Suspense>
    </div>
  );
}
