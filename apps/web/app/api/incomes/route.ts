import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { incomeCreateSchema } from '@/lib/schemas';
import { requireAdministrationAccess } from '@/lib/plan-guard';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const db = getDb();
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');
  const category = searchParams.get('category');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const rangeFrom = (page - 1) * pageSize;

  let query = db
    .from('incomes')
    .select(`
      *,
      project:projects(id, name)
    `, { count: 'exact' })
    .eq('org_id', ctx.orgId)
    .order('date', { ascending: false })
    .range(rangeFrom, rangeFrom + pageSize - 1);

  if (projectId) query = query.eq('project_id', projectId);
  if (category) query = query.ilike('category', `%${category}%`);
  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  const { data, error } = await db
    .from('incomes')
    .insert({
      org_id: ctx.orgId,
      project_id: body.project_id,
      amount: body.amount,
      date: body.date,
      category: body.category,
      description: body.description,
      created_by: ctx.dbUserId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
