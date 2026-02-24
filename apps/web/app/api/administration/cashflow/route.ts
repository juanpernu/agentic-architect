import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { requireAdministrationAccess } from '@/lib/plan-guard';
import { dbError } from '@/lib/api-error';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const planError = await requireAdministrationAccess(ctx.orgId);
  if (planError) return planError;

  const db = getDb();
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');
  const rawYear = searchParams.get('year');
  const yearInt = rawYear ? parseInt(rawYear, 10) : new Date().getFullYear();
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
  }

  const dateFrom = `${yearInt}-01-01`;
  const dateTo = `${yearInt}-12-31`;

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

  if (incomeResult.error) return dbError(incomeResult.error, 'select', { route: '/api/administration/cashflow' });
  if (expenseResult.error) return dbError(expenseResult.error, 'select', { route: '/api/administration/cashflow' });

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

  // Group incomes by month (parse directly to avoid timezone issues)
  for (const inc of incomes) {
    const monthIndex = parseInt(inc.date.slice(5, 7), 10) - 1;
    months[monthIndex].totalIncome += Number(inc.amount);
  }

  // Group expenses by month
  for (const exp of expenses) {
    const monthIndex = parseInt(exp.date.slice(5, 7), 10) - 1;
    months[monthIndex].totalExpense += Number(exp.amount);
  }

  // Calculate balance per month
  for (const m of months) {
    m.balance = m.totalIncome - m.totalExpense;
  }

  return NextResponse.json(months);
}
