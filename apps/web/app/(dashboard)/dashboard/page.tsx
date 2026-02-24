import { Suspense } from 'react';
import { DashboardGreeting } from '@/components/dashboard/dashboard-greeting';
import { DashboardKPIs } from '@/components/dashboard/dashboard-kpis';
import { RecentReceipts } from '@/components/dashboard/recent-receipts';
import { ProgressBarList } from '@/components/ui/progress-bar-list';
import { BarChartSimple } from '@/components/ui/bar-chart-simple';
import { Skeleton } from '@/components/ui/skeleton';
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
    .select('id, name, receipts!inner(total_amount)')
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
      total_spend: (p.receipts as Array<{ total_amount: number }>)
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

async function SpendTrendSection() {
  const data = await fetchSpendTrend();
  return (
    <BarChartSimple
      title="Tendencia Mensual"
      description="Flujo de gastos en los últimos 6 meses."
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
        <Suspense fallback={<ChartSkeleton />}>
          <SpendTrendSection />
        </Suspense>
      </div>

      {/* Recent Receipts */}
      <Suspense fallback={<ReceiptsSkeleton />}>
        <RecentReceipts />
      </Suspense>
    </div>
  );
}
