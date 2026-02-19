import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { projectCreateSchema } from '@/lib/schemas';
import { checkPlanLimit } from '@/lib/plan-guard';

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
  const projects = (data ?? []).map(({ receipts, ...p }) => ({
    ...p,
    total_spend: (receipts as Array<{ total_amount: number }>)
      ?.reduce((sum: number, r: { total_amount: number }) => sum + Number(r.total_amount), 0) ?? 0,
  }));

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.role === 'architect') return forbidden();

  const guard = await checkPlanLimit(ctx.orgId, 'project');
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  const result = await validateBody(projectCreateSchema, req);
  if ('error' in result) return result.error;
  const { name, address, status, architect_id, color } = result.data;

  const db = getDb();

  const { data, error } = await db
    .from('projects')
    .insert({
      organization_id: ctx.orgId,
      name,
      address,
      status,
      architect_id,
      color,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
