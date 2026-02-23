import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { receipt_id, description, quantity, unit_price } = body as {
    receipt_id?: string;
    description?: string;
    quantity?: number;
    unit_price?: number;
  };

  if (!receipt_id || !description) {
    return NextResponse.json({ error: 'receipt_id y description son requeridos' }, { status: 400 });
  }

  const db = getDb();

  // Verify receipt belongs to this org
  const { data: receipt } = await db
    .from('receipts')
    .select('id, projects!inner(organization_id)')
    .eq('id', receipt_id)
    .eq('projects.organization_id', ctx.orgId)
    .single();

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const qty = quantity ?? 1;
  const price = unit_price ?? 0;

  const { data, error } = await db
    .from('receipt_items')
    .insert({ receipt_id, description, quantity: qty, unit_price: price })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
