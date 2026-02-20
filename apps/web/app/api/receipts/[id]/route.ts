import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb, getSignedImageUrl } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const db = getDb();

  const { data, error } = await db
    .from('receipts')
    .select('*, project:projects!inner(id, name, color, organization_id), uploader:users!uploaded_by(id, full_name), receipt_items(*), rubro:rubros(id, name, color), bank_account:bank_accounts(id, name, bank_name)')
    .eq('id', id)
    .eq('project.organization_id', ctx.orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Generate signed URL for the receipt image
  if (data.image_url) {
    data.image_url = await getSignedImageUrl(data.image_url);
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'admin') return forbidden();

  const { id } = await params;
  const db = getDb();

  // Verify the receipt belongs to the org before deleting
  const { data: receipt } = await db
    .from('receipts')
    .select('id, projects!inner(organization_id)')
    .eq('id', id)
    .eq('projects.organization_id', ctx.orgId)
    .single();

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await db.from('receipts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

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

  // Verify receipt belongs to org
  const { data: existing } = await db
    .from('receipts')
    .select('id, projects!inner(organization_id)')
    .eq('id', id)
    .eq('projects.organization_id', ctx.orgId)
    .single();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateFields: Record<string, unknown> = {};
  if (body.rubro_id !== undefined) {
    // Validate rubro_id belongs to the same org (via budget)
    if (body.rubro_id !== null) {
      const { data: validRubro } = await db
        .from('rubros')
        .select('id, budget:budgets!budget_id(organization_id)')
        .eq('id', body.rubro_id as string)
        .maybeSingle();

      if (!validRubro || (validRubro.budget as { organization_id: string })?.organization_id !== ctx.orgId) {
        return NextResponse.json(
          { error: 'Rubro no válido' },
          { status: 400 }
        );
      }
    }
    updateFields.rubro_id = body.rubro_id;
  }

  if (body.bank_account_id !== undefined) {
    if (body.bank_account_id !== null) {
      const { data: validBA } = await db
        .from('bank_accounts')
        .select('id')
        .eq('id', body.bank_account_id as string)
        .eq('organization_id', ctx.orgId)
        .eq('is_active', true)
        .maybeSingle();

      if (!validBA) {
        return NextResponse.json(
          { error: 'Cuenta bancaria no válida o inactiva' },
          { status: 400 }
        );
      }
    }
    updateFields.bank_account_id = body.bank_account_id;
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const { data, error } = await db
    .from('receipts')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
