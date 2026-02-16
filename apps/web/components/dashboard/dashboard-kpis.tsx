import { Building2, DollarSign, Receipt, Clock } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { formatCurrency } from '@/lib/format';
import { getAuthContext } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import type { DashboardStats } from '@obralink/shared';

async function fetchStats(): Promise<DashboardStats | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const db = getDb();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const startOfWeek = weekStart.toISOString();

  const architectFilter = ctx.role === 'architect' ? ctx.dbUserId : null;

  let projectsQuery = db.from('projects').select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId).eq('status', 'active');
  if (architectFilter) projectsQuery = projectsQuery.eq('architect_id', architectFilter);

  let monthlySpendQuery = db.from('receipts').select('total_amount, projects!inner(organization_id, architect_id)')
    .eq('projects.organization_id', ctx.orgId)
    .eq('status', 'confirmed')
    .gte('receipt_date', startOfMonth);
  if (architectFilter) monthlySpendQuery = monthlySpendQuery.eq('projects.architect_id', architectFilter);

  let weeklyReceiptsQuery = db.from('receipts').select('id, projects!inner(organization_id, architect_id)', { count: 'exact', head: true })
    .eq('projects.organization_id', ctx.orgId)
    .gte('created_at', startOfWeek);
  if (architectFilter) weeklyReceiptsQuery = weeklyReceiptsQuery.eq('projects.architect_id', architectFilter);

  let pendingReviewQuery = db.from('receipts').select('id, projects!inner(organization_id, architect_id)', { count: 'exact', head: true })
    .eq('projects.organization_id', ctx.orgId)
    .eq('status', 'pending');
  if (architectFilter) pendingReviewQuery = pendingReviewQuery.eq('projects.architect_id', architectFilter);

  const [projects, monthlySpend, weeklyReceipts, pendingReview] = await Promise.all([
    projectsQuery, monthlySpendQuery, weeklyReceiptsQuery, pendingReviewQuery,
  ]);

  const totalMonthlySpend = (monthlySpend.data ?? [])
    .reduce((sum, r) => sum + Number(r.total_amount), 0);

  return {
    active_projects: projects.count ?? 0,
    monthly_spend: totalMonthlySpend,
    weekly_receipts: weeklyReceipts.count ?? 0,
    pending_review: pendingReview.count ?? 0,
  };
}

export async function DashboardKPIs() {
  const data = await fetchStats();

  if (!data) {
    return (
      <div className="text-sm text-muted-foreground">
        Error cargando estadísticas
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <KPICard title="Proyectos Activos" value={data.active_projects} icon={Building2} />
      <KPICard title="Gasto Mensual" value={formatCurrency(data.monthly_spend)} icon={DollarSign} />
      <KPICard title="Comprobantes esta Semana" value={data.weekly_receipts} icon={Receipt} />
      <KPICard title="Pendientes de Revisión" value={data.pending_review} icon={Clock} />
    </div>
  );
}
