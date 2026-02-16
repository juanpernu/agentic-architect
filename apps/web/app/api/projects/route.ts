import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  let query = db
    .from('projects')
    .select('*, architect:users!architect_id(id, full_name), receipts(total_amount)')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: false });

  // Architects only see their assigned projects
  if (ctx.role === 'architect') {
    query = query.eq('architect_id', ctx.dbUserId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate total_spend per project
  const projects = (data ?? []).map((p) => ({
    ...p,
    total_spend: (p.receipts as Array<{ total_amount: number }>)
      ?.reduce((sum: number, r: { total_amount: number }) => sum + Number(r.total_amount), 0) ?? 0,
    receipts: undefined,
  }));

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const body = await req.json();
  const db = getDb();

  const { data, error } = await db
    .from('projects')
    .insert({
      organization_id: ctx.orgId,
      name: body.name,
      address: body.address ?? null,
      status: body.status ?? 'active',
      architect_id: body.architect_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
