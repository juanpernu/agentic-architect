import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  const { data, error } = await db
    .from('projects')
    .select('id, name, receipts(total_amount)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (data ?? []).map((p) => ({
    project_id: p.id,
    project_name: p.name,
    total_spend: (p.receipts as Array<{ total_amount: number }>)
      ?.reduce((sum: number, r: { total_amount: number }) => sum + Number(r.total_amount), 0) ?? 0,
  }));

  return NextResponse.json(result);
}
