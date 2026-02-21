import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

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
  const snapshot = budget.snapshot as { sections: Array<{ rubro_id: string; rubro_name: string; items: Array<{ subtotal: number }> }> };

  const rubroMap = new Map<string, { rubroId: string; rubroName: string; budgeted: number }>();
  for (const section of snapshot.sections) {
    const budgeted = section.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    rubroMap.set(section.rubro_id, {
      rubroId: section.rubro_id,
      rubroName: section.rubro_name,
      budgeted,
    });
  }

  // Get actual expenses per rubro for this project
  const { data: expenses } = await db
    .from('expenses')
    .select('rubro_id, amount')
    .eq('org_id', ctx.orgId)
    .eq('project_id', projectId)
    .not('rubro_id', 'is', null);

  // Sum expenses by rubro
  const actualByRubro = new Map<string, number>();
  for (const exp of expenses ?? []) {
    if (!exp.rubro_id) continue;
    actualByRubro.set(exp.rubro_id, (actualByRubro.get(exp.rubro_id) || 0) + Number(exp.amount));
  }

  // Build result
  const rubros = Array.from(rubroMap.values()).map(r => {
    const actual = actualByRubro.get(r.rubroId) || 0;
    const difference = r.budgeted - actual;
    const percentage = r.budgeted > 0 ? Math.round((actual / r.budgeted) * 100) : 0;
    return { ...r, actual, difference, percentage };
  });

  const totalBudgeted = rubros.reduce((s, r) => s + r.budgeted, 0);
  const totalActual = rubros.reduce((s, r) => s + r.actual, 0);

  return NextResponse.json({
    rubros,
    hasPublishedBudget: true,
    totalBudgeted,
    totalActual,
    totalDifference: totalBudgeted - totalActual,
    globalPercentage: totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0,
  });
}
