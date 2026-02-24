import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { bankAccountUpdateSchema } from '@/lib/schemas';
import { dbError } from '@/lib/api-error';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;

  const result = await validateBody(bankAccountUpdateSchema, req);
  if ('error' in result) return result.error;
  const updates = result.data;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('bank_accounts')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .select()
    .single();

  if (error) return dbError(error, 'update', { route: '/api/bank-accounts/[id]' });
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

  if (error) return dbError(error, 'delete', { route: '/api/bank-accounts/[id]' });
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
