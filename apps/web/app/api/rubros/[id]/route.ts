import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { rubroUpdateSchema } from '@/lib/schemas';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const result = rubroUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
  }

  const db = getDb();

  const { data: rubro } = await db
    .from('rubros')
    .select('id, budget:budgets!budget_id(organization_id)')
    .eq('id', id)
    .single();

  if (!rubro || (rubro.budget as { organization_id: string })?.organization_id !== ctx.orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: updated, error } = await db
    .from('rubros')
    .update(result.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const { id } = await params;
  const db = getDb();

  const { count } = await db
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('rubro_id', id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar un rubro con comprobantes asociados' },
      { status: 409 }
    );
  }

  const { error } = await db
    .from('rubros')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
