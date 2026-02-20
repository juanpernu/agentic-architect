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
        href="/projects"
        actionLabel="Ver proyectos"
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
