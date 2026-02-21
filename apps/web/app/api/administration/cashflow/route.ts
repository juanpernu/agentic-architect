import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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
    .select('date, amount')
    .eq('org_id', ctx.orgId)
    .gte('date', dateFrom)
    .lte('date', dateTo);
  if (projectId) incomeQuery = incomeQuery.eq('project_id', projectId);

  // Build expense query
  let expenseQuery = db
    .from('expenses')
    .select('date, amount')
    .eq('org_id', ctx.orgId)
    .gte('date', dateFrom)
    .lte('date', dateTo);
  if (projectId) expenseQuery = expenseQuery.eq('project_id', projectId);

  const [incomeResult, expenseResult] = await Promise.all([incomeQuery, expenseQuery]);

  if (incomeResult.error) return NextResponse.json({ error: incomeResult.error.message }, { status: 500 });
  if (expenseResult.error) return NextResponse.json({ error: expenseResult.error.message }, { status: 500 });

  const incomes = incomeResult.data ?? [];
  const expenses = expenseResult.data ?? [];

  // Initialize 12 months
  const months = MONTH_NAMES.map((name, i) => ({
    month: i + 1,
    monthName: name,
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
  }));

  // Group incomes by month
  for (const inc of incomes) {
    const monthIndex = new Date(inc.date).getMonth();
    months[monthIndex].totalIncome += Number(inc.amount);
  }

  // Group expenses by month
  for (const exp of expenses) {
    const monthIndex = new Date(exp.date).getMonth();
    months[monthIndex].totalExpense += Number(exp.amount);
  }

  // Calculate balance per month
  for (const m of months) {
    m.balance = m.totalIncome - m.totalExpense;
  }

  return NextResponse.json(months);
}
