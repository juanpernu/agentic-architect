import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { expenseUpdateSchema } from '@/lib/schemas';
import { requireAdministrationAccess } from '@/lib/plan-guard';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const db = getDb();
  const { data, error } = await db
    .from('expenses')
    .select(`
      *,
      expense_type:expense_types(id, name),
      project:projects(id, name),
      rubro:rubros(id, name),
      receipt:receipts(id, vendor, total_amount, image_url)
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

  const result = await validateBody(expenseUpdateSchema, req);
  if ('error' in result) return result.error;
  const body = result.data;

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = getDb();

  // Verify the expense exists and belongs to this org
  const { data: existing } = await db
    .from('expenses')
    .select('id, project_id')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .single();
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const effectiveProjectId = body.project_id ?? existing.project_id;

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

  // If expense_type_id changes, verify it belongs to org
  if (body.expense_type_id !== undefined) {
    const { data: expenseType } = await db
      .from('expense_types')
      .select('id')
      .eq('id', body.expense_type_id)
      .eq('org_id', ctx.orgId)
      .eq('is_active', true)
      .single();
    if (!expenseType) return NextResponse.json({ error: 'Tipo de egreso no válido' }, { status: 400 });
  }

  // If rubro_id changes, verify it belongs to the (possibly new) project and org
  if (body.rubro_id !== undefined && body.rubro_id !== null) {
    const { data: rubro } = await db
      .from('rubros')
      .select('id, budget:budgets!inner(project_id, organization_id)')
      .eq('id', body.rubro_id)
      .single();
    const budgetData = rubro?.budget as unknown as { project_id: string; organization_id: string } | null;
    if (!rubro || budgetData?.project_id !== effectiveProjectId || budgetData?.organization_id !== ctx.orgId) {
      return NextResponse.json({ error: 'El rubro no pertenece a este proyecto' }, { status: 400 });
    }
  }

  // If receipt_id changes, verify it belongs to the project
  if (body.receipt_id !== undefined && body.receipt_id !== null) {
    const { data: receipt } = await db
      .from('receipts')
      .select('id')
      .eq('id', body.receipt_id)
      .eq('project_id', effectiveProjectId)
      .single();
    if (!receipt) return NextResponse.json({ error: 'El comprobante no pertenece a este proyecto' }, { status: 400 });
  }

  // Build update object dynamically from provided fields
  const updates: Record<string, unknown> = {};
  if (body.project_id !== undefined) updates.project_id = body.project_id;
  if (body.amount !== undefined) updates.amount = body.amount;
  if (body.date !== undefined) updates.date = body.date;
  if (body.expense_type_id !== undefined) updates.expense_type_id = body.expense_type_id;
  if (body.rubro_id !== undefined) updates.rubro_id = body.rubro_id || null;
  if (body.receipt_id !== undefined) updates.receipt_id = body.receipt_id || null;
  if (body.description !== undefined) updates.description = body.description;

  const { data, error } = await db
    .from('expenses')
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
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ success: true });
}
