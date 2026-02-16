import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const status = searchParams.get('status');

  const db = getDb();

  let query = db
    .from('receipts')
    .select('*, project:projects!project_id(id, name), uploader:users!uploaded_by(id, full_name)')
    .order('created_at', { ascending: false });

  // Filter by org via projects
  query = query.eq('project.organization_id', ctx.orgId);

  if (projectId) query = query.eq('project_id', projectId);
  if (status) query = query.eq('status', status);

  // Architects only see own receipts
  if (ctx.role === 'architect') {
    query = query.eq('uploaded_by', ctx.dbUserId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await req.json();
  const db = getDb();

  // Insert receipt
  const { data: receipt, error: receiptError } = await db
    .from('receipts')
    .insert({
      project_id: body.project_id,
      uploaded_by: ctx.dbUserId,
      vendor: body.vendor,
      total_amount: body.total_amount,
      receipt_date: body.receipt_date,
      image_url: body.image_url,
      ai_raw_response: body.ai_raw_response ?? {},
      ai_confidence: body.ai_confidence ?? 0,
      status: 'confirmed',
    })
    .select()
    .single();

  if (receiptError) return NextResponse.json({ error: receiptError.message }, { status: 500 });

  // Insert receipt items if provided
  if (body.items?.length > 0) {
    const items = body.items.map((item: { description: string; quantity: number; unit_price: number }) => ({
      receipt_id: receipt.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await db.from('receipt_items').insert(items);
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json(receipt, { status: 201 });
}
