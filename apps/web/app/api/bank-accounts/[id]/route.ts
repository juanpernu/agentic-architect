import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

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

  if (body.bank_name !== undefined && !(body.bank_name as string).trim()) {
    return NextResponse.json({ error: 'El nombre del banco no puede estar vacío' }, { status: 400 });
  }

  const VALID_CURRENCIES = ['ARS', 'USD'];
  if (body.currency !== undefined && !VALID_CURRENCIES.includes(body.currency as string)) {
    return NextResponse.json({ error: 'Moneda no válida. Opciones: ARS, USD' }, { status: 400 });
  }

  const db = getDb();

  const updateFields: Record<string, unknown> = {};
  if (body.name !== undefined) updateFields.name = (body.name as string).trim();
  if (body.bank_name !== undefined) updateFields.bank_name = (body.bank_name as string).trim();
  if (body.cbu !== undefined) updateFields.cbu = body.cbu ? (body.cbu as string).trim() : null;
  if (body.alias !== undefined) updateFields.alias = body.alias ? (body.alias as string).trim() : null;
  if (body.currency !== undefined) updateFields.currency = body.currency;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const { data, error } = await db
    .from('bank_accounts')
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
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;
  const db = getDb();

  // Soft-delete: set is_active = false
  const { data, error } = await db
    .from('bank_accounts')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
