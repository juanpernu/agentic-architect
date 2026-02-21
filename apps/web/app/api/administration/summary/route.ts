import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const db = getDb();

  // Plan guard: free plan cannot access administration
  const { data: org } = await db
    .from('organizations')
    .select('plan')
    .eq('id', ctx.orgId)
    .single();

  if (org?.plan === 'free') {
    return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
  }
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');
  const year = searchParams.get('year') || new Date().getFullYear().toString();

  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;

  // Build income query
  let incomeQuery = db
    .from('incomes')
    .select('project_id, amount, project:projects(id, name)')
    .eq('org_id', ctx.orgId)
    .gte('date', dateFrom)
    .lte('date', dateTo);
  if (projectId) incomeQuery = incomeQuery.eq('project_id', projectId);

  // Build expense query
  let expenseQuery = db
    .from('expenses')
    .select('project_id, amount, project:projects(id, name)')
    .eq('org_id', ctx.orgId)
    .gte('date', dateFrom)
    .lte('date', dateTo);
  if (projectId) expenseQuery = expenseQuery.eq('project_id', projectId);

  const [incomeResult, expenseResult] = await Promise.all([incomeQuery, expenseQuery]);

  if (incomeResult.error) return NextResponse.json({ error: incomeResult.error.message }, { status: 500 });
  if (expenseResult.error) return NextResponse.json({ error: expenseResult.error.message }, { status: 500 });

  // Aggregate totals
  const incomes = incomeResult.data ?? [];
  const expenses = expenseResult.data ?? [];

  let totalIncome = 0;
  let totalExpense = 0;
  const projectMap = new Map<string, { projectId: string; projectName: string; totalIncome: number; totalExpense: number }>();

  for (const inc of incomes) {
    const amount = Number(inc.amount);
    totalIncome += amount;
    const proj = inc.project as unknown as { id: string; name: string } | null;
    if (proj) {
      const existing = projectMap.get(proj.id) || { projectId: proj.id, projectName: proj.name, totalIncome: 0, totalExpense: 0 };
      existing.totalIncome += amount;
      projectMap.set(proj.id, existing);
    }
  }

  for (const exp of expenses) {
    const amount = Number(exp.amount);
    totalExpense += amount;
    const proj = exp.project as unknown as { id: string; name: string } | null;
    if (proj) {
      const existing = projectMap.get(proj.id) || { projectId: proj.id, projectName: proj.name, totalIncome: 0, totalExpense: 0 };
      existing.totalExpense += amount;
      projectMap.set(proj.id, existing);
    }
  }

  const byProject = Array.from(projectMap.values()).map(p => ({
    ...p,
    balance: p.totalIncome - p.totalExpense,
  })).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  return NextResponse.json({
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byProject,
  });
}
