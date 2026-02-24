import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { dbError } from '@/lib/api-error';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  let query = db
    .from('projects')
    .select('id, name, receipts!inner(total_amount)')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'active');

  // Architects only see their own projects
  if (ctx.role === 'architect') {
    query = query.eq('architect_id', ctx.dbUserId);
  }

  const { data, error } = await query;

  if (error) return dbError(error, 'select', { route: '/api/dashboard/spend-by-project' });

  const result = (data ?? []).map((p) => ({
    project_id: p.id,
    project_name: p.name,
    total_spend: (p.receipts as Array<{ total_amount: number }>)
      ?.reduce((sum: number, r) => sum + Number(r.total_amount), 0) ?? 0,
  }));

  return NextResponse.json(result);
}
