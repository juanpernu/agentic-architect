import { NextResponse } from 'next/server';
import { getDb } from '@/lib/supabase';
import { PLAN_LIMITS } from '@architech/shared/plans';

type Resource = 'project' | 'receipt' | 'user' | 'reports';

/**
 * Returns a 403 NextResponse if the org is on the free plan,
 * or null if administration access is allowed.
 */
export async function requireAdministrationAccess(
  orgId: string
): Promise<NextResponse | null> {
  const db = getDb();
  const { data: org } = await db
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single();
  if (org?.plan === 'free') {
    return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });
  }
  return null;
}

interface Allowed {
  allowed: true;
}
interface Denied {
  allowed: false;
  reason: string;
}

export async function checkPlanLimit(
  orgId: string,
  resource: Resource,
  extra?: { projectId?: string }
): Promise<Allowed | Denied> {
  const db = getDb();

  const { data: org } = await db
    .from('organizations')
    .select('plan, max_seats')
    .eq('id', orgId)
    .single();

  if (!org) return { allowed: false, reason: 'Organización no encontrada' };

  const plan = org.plan as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan];

  switch (resource) {
    case 'project': {
      if (limits.maxProjects === Infinity) return { allowed: true };
      const { count } = await db
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);
      if ((count ?? 0) >= limits.maxProjects) {
        return {
          allowed: false,
          reason: `Tu plan permite hasta ${limits.maxProjects} proyecto${limits.maxProjects === 1 ? '' : 's'}. Actualizá tu plan para crear más.`,
        };
      }
      return { allowed: true };
    }

    case 'receipt': {
      if (limits.maxReceiptsPerProject === Infinity) return { allowed: true };
      if (!extra?.projectId) return { allowed: true };
      const { count } = await db
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', extra.projectId);
      if ((count ?? 0) >= limits.maxReceiptsPerProject) {
        return {
          allowed: false,
          reason: `Tu plan permite hasta ${limits.maxReceiptsPerProject} comprobantes por proyecto. Actualizá tu plan para cargar más.`,
        };
      }
      return { allowed: true };
    }

    case 'user': {
      const maxSeats =
        plan === 'advance' ? org.max_seats : limits.maxSeats;
      if (maxSeats === Infinity) return { allowed: true };
      const { count } = await db
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true);
      if ((count ?? 0) >= (maxSeats ?? 1)) {
        return {
          allowed: false,
          reason: `Tu plan permite hasta ${maxSeats} usuario${maxSeats === 1 ? '' : 's'}. Actualizá tu plan para invitar más.`,
        };
      }
      return { allowed: true };
    }

    case 'reports': {
      if (!limits.reports) {
        return {
          allowed: false,
          reason: 'Los reportes están disponibles a partir del plan Advance.',
        };
      }
      return { allowed: true };
    }
  }
}
