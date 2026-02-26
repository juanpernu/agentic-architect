import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { requireAdministrationAccess } from '@/lib/plan-guard';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const planError = await requireAdministrationAccess(ctx.orgId);
  if (planError) return planError;

  const db = getDb();
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

  // Verify project belongs to org
  const { data: project } = await db
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', ctx.orgId)
    .single();
  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 403 });

  // Find published budget
  const { data: budget } = await db
    .from('budgets')
    .select('id, snapshot')
    .eq('project_id', projectId)
    .eq('status', 'published')
    .single();

  if (!budget || !budget.snapshot) {
    return NextResponse.json({ rubros: [], hasPublishedBudget: false });
  }

  // Parse snapshot to get budgeted amounts per rubro
  const snapshot = budget.snapshot as { sections: Array<{ rubro_id: string; rubro_name: string; subtotal?: number; cost?: number; items: Array<{ cost: number; subtotal: number }> }> };

  const rubroMap = new Map<string, { rubroId: string; rubroName: string; budgeted: number; cost: number }>();
  for (const section of snapshot.sections) {
    const budgeted = section.subtotal != null ? section.subtotal : section.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const cost = section.cost != null ? section.cost : section.items.reduce((sum, item) => sum + (item.cost || 0), 0);
    rubroMap.set(section.rubro_id, {
      rubroId: section.rubro_id,
      rubroName: section.rubro_name,
      budgeted,
      cost,
    });
  }

  // Get actual spending per rubro: from expenses + receipts
  const [{ data: expenses }, { data: receipts }] = await Promise.all([
    db.from('expenses')
      .select('rubro_id, amount')
      .eq('org_id', ctx.orgId)
      .eq('project_id', projectId)
      .not('rubro_id', 'is', null),
    db.from('receipts')
      .select('rubro_id, total_amount, project:projects!project_id(organization_id)')
      .eq('project_id', projectId)
      .not('rubro_id', 'is', null),
  ]);

  // Sum by rubro
  const actualByRubro = new Map<string, number>();
  for (const exp of expenses ?? []) {
    if (!exp.rubro_id) continue;
    actualByRubro.set(exp.rubro_id, (actualByRubro.get(exp.rubro_id) || 0) + Number(exp.amount));
  }
  for (const r of receipts ?? []) {
    if (!r.rubro_id) continue;
    actualByRubro.set(r.rubro_id, (actualByRubro.get(r.rubro_id) || 0) + Number(r.total_amount));
  }

  // Build result
  const rubros = Array.from(rubroMap.values()).map(r => {
    const actual = actualByRubro.get(r.rubroId) || 0;
    const difference = r.cost - actual;
    const percentage = r.cost > 0 ? Math.round((actual / r.cost) * 100) : 0;
    return { ...r, actual, difference, percentage };
  });

  const totalBudgeted = rubros.reduce((s, r) => s + r.budgeted, 0);
  const totalCost = rubros.reduce((s, r) => s + r.cost, 0);
  const totalActual = rubros.reduce((s, r) => s + r.actual, 0);

  return NextResponse.json({
    rubros,
    hasPublishedBudget: true,
    totalBudgeted,
    totalCost,
    totalActual,
    totalDifference: totalCost - totalActual,
    globalPercentage: totalCost > 0 ? Math.round((totalActual / totalCost) * 100) : 0,
  });
}
