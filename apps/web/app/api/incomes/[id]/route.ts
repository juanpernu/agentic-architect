import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { incomeUpdateSchema } from '@/lib/schemas';
import { requireAdministrationAccess } from '@/lib/plan-guard';
import { dbError } from '@/lib/api-error';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const db = getDb();
  const { data, error } = await db
    .from('incomes')
    .select(`
      *,
      income_type:income_types(id, name),
      project:projects(id, name)
    `)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single();

  if (error) return dbError(error, 'select', { route: '/api/incomes/[id]' });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const planError = await requireAdministrationAccess(ctx.orgId);
  if (planError) return planError;

  const result = await validateBody(incomeUpdateSchema, req);
  if ('error' in result) return result.error;
  const body = result.data;

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = getDb();

  // Verify the income exists and belongs to this org
  const { data: existing } = await db
    .from('incomes')
    .select('id')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single();
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // If project_id changes, verify new project belongs to org
  if (body.project_id !== undefined) {
    const { data: project } = await db
      .from('projects')
      .select('id')
      .eq('id', body.project_id)
      .eq('organization_id', ctx.orgId)
      .single();
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 400 });
  }

  // If income_type_id changes, verify it belongs to org
  if (body.income_type_id !== undefined) {
    const { data: incomeType } = await db
      .from('income_types')
      .select('id')
      .eq('id', body.income_type_id)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true)
      .single();
    if (!incomeType) return NextResponse.json({ error: 'Tipo de ingreso no válido' }, { status: 400 });
  }

  // Build update object dynamically from provided fields
  const updates: Record<string, unknown> = {};
  if (body.project_id !== undefined) updates.project_id = body.project_id;
  if (body.amount !== undefined) updates.amount = body.amount;
  if (body.date !== undefined) updates.date = body.date;
  if (body.income_type_id !== undefined) updates.income_type_id = body.income_type_id;
  if (body.description !== undefined) updates.description = body.description;

  const { data, error } = await db
    .from('incomes')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single();

  if (error) return dbError(error, 'update', { route: '/api/incomes/[id]' });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const planError = await requireAdministrationAccess(ctx.orgId);
  if (planError) return planError;

  const db = getDb();
  const { data, error } = await db
    .from('incomes')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .maybeSingle();

  if (error) return dbError(error, 'delete', { route: '/api/incomes/[id]' });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ success: true });
}
