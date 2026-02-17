import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

const VALID_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (body.name !== undefined && !(body.name as string).trim()) {
    return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
  }

  if (body.name && (body.name as string).length > 100) {
    return NextResponse.json({ error: 'El nombre no puede exceder 100 caracteres' }, { status: 400 });
  }

  if (body.color !== undefined && body.color !== null && !VALID_COLORS.includes(body.color as string)) {
    return NextResponse.json({ error: `color debe ser uno de: ${VALID_COLORS.join(', ')}` }, { status: 400 });
  }

  const db = getDb();

  const updateFields: Record<string, unknown> = {};
  if (body.name !== undefined) updateFields.name = (body.name as string).trim();
  if (body.description !== undefined) updateFields.description = body.description ? (body.description as string).trim() : null;
  if (body.color !== undefined) updateFields.color = body.color;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const { data, error } = await db
    .from('cost_centers')
    .update(updateFields)
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;
  const db = getDb();

  // Soft-delete: set is_active = false
  const { data, error } = await db
    .from('cost_centers')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
