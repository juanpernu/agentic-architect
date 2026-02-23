import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

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

  const db = getDb();

  // Verify item belongs to a receipt in this org
  const { data: item } = await db
    .from('receipt_items')
    .select('id, receipt:receipts!inner(id, project:projects!inner(organization_id))')
    .eq('id', id)
    .single();

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const receipt = item.receipt as unknown as { id: string; project: { organization_id: string } };
  if (receipt.project.organization_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updateFields: Record<string, unknown> = {};
  const allowedFields = ['description', 'quantity', 'unit_price'] as const;
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateFields[field] = body[field];
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const { data, error } = await db
    .from('receipt_items')
    .update(updateFields)
    .eq('id', id)
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

  // Verify item belongs to a receipt in this org
  const { data: item } = await db
    .from('receipt_items')
    .select('id, receipt:receipts!inner(id, project:projects!inner(organization_id))')
    .eq('id', id)
    .single();

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const receipt = item.receipt as unknown as { id: string; project: { organization_id: string } };
  if (receipt.project.organization_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await db.from('receipt_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
