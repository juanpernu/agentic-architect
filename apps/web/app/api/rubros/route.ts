import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { rubroCreateSchema } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const budgetId = req.nextUrl.searchParams.get('budget_id');

  if (budgetId) {
    const { data, error } = await db
      .from('rubros')
      .select('*, budget:budgets!budget_id!inner(id, project_id, organization_id)')
      .eq('budget_id', budgetId)
      .eq('budget.organization_id', ctx.orgId)
      .order('sort_order', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json((data ?? []).map(({ budget, ...r }) => r));
  }

  // All rubros for the org (filtered at DB level)
  const { data, error } = await db
    .from('rubros')
    .select('*, budget:budgets!budget_id!inner(id, organization_id)')
    .eq('budget.organization_id', ctx.orgId)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json((data ?? []).map(({ budget, ...r }) => r));
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = rubroCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const db = getDb();

  // Verify budget belongs to org
  const { data: budget } = await db
    .from('budgets')
    .select('id')
    .eq('id', result.data.budget_id)
    .eq('organization_id', ctx.orgId)
    .single();

  if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });

  // Get next sort_order
  const { data: existing } = await db
    .from('rubros')
    .select('sort_order')
    .eq('budget_id', result.data.budget_id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data: rubro, error } = await db
    .from('rubros')
    .insert({
      budget_id: result.data.budget_id,
      name: result.data.name,
      color: result.data.color ?? null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(rubro, { status: 201 });
}
