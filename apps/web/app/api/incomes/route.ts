import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { incomeCreateSchema } from '@/lib/schemas';
import { requireAdministrationAccess } from '@/lib/plan-guard';
import { dbError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const db = getDb();
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');
  const incomeTypeId = searchParams.get('incomeTypeId');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const rangeFrom = (page - 1) * pageSize;

  let query = db
    .from('incomes')
    .select(`
      *,
      income_type:income_types(id, name),
      project:projects(id, name)
    `, { count: 'exact' })
    .eq('org_id', ctx.orgId)
    .order('date', { ascending: false })
    .range(rangeFrom, rangeFrom + pageSize - 1);

  if (projectId) query = query.eq('project_id', projectId);
  if (incomeTypeId) query = query.eq('income_type_id', incomeTypeId);
  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  const { data, error, count } = await query;
  if (error) return dbError(error, 'select', { route: '/api/incomes' });
  return NextResponse.json({ data, total: count, page, pageSize });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const planError = await requireAdministrationAccess(ctx.orgId);
  if (planError) return planError;

  const result = await validateBody(incomeCreateSchema, req);
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

  // Verify income_type belongs to org (if provided)
  if (body.income_type_id) {
    const { data: incomeType } = await db
      .from('income_types')
      .select('id')
      .eq('id', body.income_type_id)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true)
      .single();
    if (!incomeType) return NextResponse.json({ error: 'Tipo de ingreso no válido' }, { status: 400 });
  }

  // Verify receipt belongs to this project (if provided)
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
    .from('incomes')
    .insert({
      org_id: ctx.orgId,
      project_id: body.project_id,
      amount: body.amount,
      date: body.date,
      income_type_id: body.income_type_id || null,
      receipt_id: body.receipt_id || null,
      description: body.description,
      created_by: ctx.dbUserId,
    })
    .select()
    .single();

  if (error) return dbError(error, 'insert', { route: '/api/incomes' });
  return NextResponse.json(data, { status: 201 });
}
