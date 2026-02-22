import { Building2, DollarSign, Receipt, Clock } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
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

function getSpendChange(current: number, previous: number): { label: string; variant: 'positive' | 'negative' } | undefined {
  if (previous === 0) return undefined;
  const pctChange = Math.round(((current - previous) / previous) * 100);
  if (pctChange === 0) return undefined;
  const sign = pctChange > 0 ? '+' : '';
  return {
    label: `${sign}${pctChange}% vs mes anterior`,
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

  const spendBadge = getSpendChange(data.monthly_spend, data.previous_month_spend);

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Proyectos Activos"
        value={data.active_projects}
        icon={Building2}
        subtitle={data.new_projects_this_week > 0 ? `+${data.new_projects_this_week} esta semana` : 'Sin cambios'}
      />
      <StatCard
        title="Gasto Mensual"
        value={formatCurrency(data.monthly_spend)}
        icon={DollarSign}
        badge={spendBadge}
      />
      <StatCard
        title="Comprobantes (Sem)"
        value={data.weekly_receipts}
        icon={Receipt}
        subtitle="Esta semana"
      />
      <StatCard
        title="Pendientes Review"
        value={data.pending_review}
        icon={Clock}
        iconColor={data.pending_review > 0 ? 'text-orange-500' : undefined}
        subtitle={data.pending_review > 0 ? 'Requiere atención' : 'Al día'}
        subtitleVariant={data.pending_review > 0 ? 'warning' : 'muted'}
        pulse={data.pending_review > 0}
      />
    </div>
  );
}
