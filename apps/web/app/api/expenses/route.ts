import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { expenseCreateSchema } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const db = getDb();
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');
  const expenseTypeId = searchParams.get('expenseTypeId');
  const rubroId = searchParams.get('rubroId');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  let query = db
    .from('expenses')
    .select(`
      *,
      expense_type:expense_types(id, name),
      project:projects(id, name),
      rubro:rubros(id, name)
    `)
    .eq('org_id', ctx.orgId)
    .order('date', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);
  if (expenseTypeId) query = query.eq('expense_type_id', expenseTypeId);
  if (rubroId) query = query.eq('rubro_id', rubroId);
  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const result = await validateBody(expenseCreateSchema, req);
  if ('error' in result) return result.error;
  const body = result.data;

  const db = getDb();

  // Verify project belongs to org
  const { data: project } = await db
    .from('projects')
    .select('id')
    .eq('id', body.project_id)
    .eq('organization_id', ctx.orgId)
    .single();
  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 400 });

  // If rubroId provided, verify it belongs to a budget of this project
  if (body.rubro_id) {
    const { data: rubro } = await db
      .from('rubros')
      .select('id, budget:budgets!inner(project_id)')
      .eq('id', body.rubro_id)
      .single();
    const budgetData = rubro?.budget as unknown as { project_id: string } | null;
    if (!rubro || budgetData?.project_id !== body.project_id) {
      return NextResponse.json({ error: 'El rubro no pertenece a este proyecto' }, { status: 400 });
    }
  }

  // If receiptId provided, verify it belongs to this project
  if (body.receipt_id) {
    const { data: receipt } = await db
      .from('receipts')
      .select('id')
      .eq('id', body.receipt_id)
      .eq('project_id', body.project_id)
      .single();
    if (!receipt) return NextResponse.json({ error: 'El comprobante no pertenece a este proyecto' }, { status: 400 });
  }

  const { data, error } = await db
    .from('expenses')
    .insert({
      org_id: ctx.orgId,
      project_id: body.project_id,
      amount: body.amount,
      date: body.date,
      expense_type_id: body.expense_type_id,
      rubro_id: body.rubro_id || null,
      receipt_id: body.receipt_id || null,
      description: body.description,
      created_by: ctx.dbUserId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
