import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { checkPlanLimit } from '@/lib/plan-guard';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const guard = await checkPlanLimit(ctx.orgId, 'reports');
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  const db = getDb();

  let query = db
    .from('receipts')
    .select('total_amount, cost_center:cost_centers!inner(id, name, color), project:projects!inner(organization_id)')
    .eq('status', 'confirmed')
    .eq('project.organization_id', ctx.orgId);

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
