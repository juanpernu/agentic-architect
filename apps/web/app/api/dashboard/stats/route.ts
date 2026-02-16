import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const startOfWeek = weekStart.toISOString();

  // Build architect filter for project-scoped queries
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
    projectsQuery,
    monthlySpendQuery,
    weeklyReceiptsQuery,
    pendingReviewQuery,
  ]);

  const totalMonthlySpend = (monthlySpend.data ?? [])
    .reduce((sum, r) => sum + Number(r.total_amount), 0);

  return NextResponse.json({
    active_projects: projects.count ?? 0,
    monthly_spend: totalMonthlySpend,
    weekly_receipts: weeklyReceipts.count ?? 0,
    pending_review: pendingReview.count ?? 0,
  });
}
