import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { PLAN_LIMITS } from '@architech/shared/plans';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();

  const { data: org } = await db
    .from('organizations')
    .select('plan, subscription_status, max_seats, billing_cycle, current_period_end')
    .eq('id', ctx.orgId)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
  }

  const [{ count: currentProjects }, { count: currentUsers }] = await Promise.all([
    db
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId),
    db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .eq('is_active', true),
  ]);

  const limits = PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS];

  return NextResponse.json({
    plan: org.plan,
    subscriptionStatus: org.subscription_status,
    billingCycle: org.billing_cycle,
    currentPeriodEnd: org.current_period_end,
    maxSeats: org.plan === 'advance' ? org.max_seats : limits.maxSeats,
    currentSeats: currentUsers ?? 0,
    currentProjects: currentProjects ?? 0,
    limits,
  });
}
