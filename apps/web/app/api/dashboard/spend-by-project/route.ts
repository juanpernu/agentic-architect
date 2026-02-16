import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  let query = db
    .from('projects')
    .select('id, name, receipts!inner(total_amount, status)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'active')
    .eq('receipts.status', 'confirmed');

  // Architects only see their own projects
  if (ctx.role === 'architect') {
    query = query.eq('architect_id', ctx.dbUserId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (data ?? []).map((p) => ({
    project_id: p.id,
    project_name: p.name,
    total_spend: (p.receipts as Array<{ total_amount: number; status: string }>)
      ?.reduce((sum: number, r) => sum + Number(r.total_amount), 0) ?? 0,
  }));

  return NextResponse.json(result);
}
