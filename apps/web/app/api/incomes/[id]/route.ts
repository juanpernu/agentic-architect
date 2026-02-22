import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { incomeUpdateSchema } from '@/lib/schemas';
import { requireAdministrationAccess } from '@/lib/plan-guard';

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
      project:projects(id, name)
    `)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  // Build update object dynamically from provided fields
  const updates: Record<string, unknown> = {};
  if (body.project_id !== undefined) updates.project_id = body.project_id;
  if (body.amount !== undefined) updates.amount = body.amount;
  if (body.date !== undefined) updates.date = body.date;
  if (body.category !== undefined) updates.category = body.category;
  if (body.description !== undefined) updates.description = body.description;

  const { data, error } = await db
    .from('incomes')
    .update(updates)
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ success: true });
}
