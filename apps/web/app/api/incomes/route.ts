import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { incomeCreateSchema } from '@/lib/schemas';

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

  let query = db
    .from('incomes')
    .select(`
      *,
      income_type:income_types(id, name),
      project:projects(id, name)
    `)
    .eq('org_id', ctx.orgId)
    .order('date', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);
  if (incomeTypeId) query = query.eq('income_type_id', incomeTypeId);
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

  const { data, error } = await db
    .from('incomes')
    .insert({
      org_id: ctx.orgId,
      project_id: body.project_id,
      amount: body.amount,
      date: body.date,
      income_type_id: body.income_type_id,
      description: body.description,
      created_by: ctx.dbUserId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
