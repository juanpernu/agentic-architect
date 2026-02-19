import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardKPIs } from '@/components/dashboard/dashboard-kpis';
import { RecentReceipts } from '@/components/dashboard/recent-receipts';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import type { SpendByProject, SpendTrend } from '@architech/shared';

// Client chart components loaded dynamically to avoid Recharts SSR issues
import { SpendByProjectChart } from '@/components/dashboard/spend-by-project-chart';
import { SpendTrendChart } from '@/components/dashboard/spend-trend-chart';

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

  return (data ?? []).map((p) => ({
    project_id: p.id,
    project_name: p.name,
    total_spend: (p.receipts as Array<{ total_amount: number; status: string }>)
      ?.reduce((sum: number, r) => sum + Number(r.total_amount), 0) ?? 0,
  }));
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
  return <SpendByProjectChart data={data} />;
}

async function SpendTrendSection() {
  const data = await fetchSpendTrend();
  return <SpendTrendChart data={data} />;
}

export default function DashboardPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        description="Resumen de tus proyectos"
      />

      <div className="space-y-6 animate-slide-up">
        {/* KPIs Section */}
        <Suspense
          fallback={
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 stagger-children">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-6 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-8 w-1/2" />
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
              <Card>
                <CardHeader>
                  <CardTitle>Gasto por Proyecto</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full" />
                </CardContent>
              </Card>
            }
          >
            <SpendByProjectSection />
          </Suspense>

          <Suspense
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle>Tendencia Mensual</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full" />
                </CardContent>
              </Card>
            }
          >
            <SpendTrendSection />
          </Suspense>
        </div>

        {/* Recent Receipts Section */}
        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <CardTitle>Comprobantes Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          }
        >
          <RecentReceipts />
        </Suspense>
      </div>
    </div>
  );
}
