import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { UserRole } from '@architech/shared';
import { getDb } from '@/lib/supabase';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: UserRole;
  dbUserId: string;
}

// In-memory cache for is_active checks (per serverless instance, 60s TTL)
const IS_ACTIVE_CACHE_TTL = 60_000;
const isActiveCache = new Map<string, { value: boolean; expiry: number }>();

async function isUserActive(dbUserId: string): Promise<boolean> {
  const cached = isActiveCache.get(dbUserId);
  if (cached && Date.now() < cached.expiry) return cached.value;

  const db = getDb();
  const { data } = await db
    .from('users')
    .select('is_active')
    .eq('id', dbUserId)
    .single();

  const active = data?.is_active !== false;
  isActiveCache.set(dbUserId, { value: active, expiry: Date.now() + IS_ACTIVE_CACHE_TTL });
  return active;
}

export function invalidateIsActiveCache(dbUserId: string) {
  isActiveCache.delete(dbUserId);
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId, orgId, sessionClaims } = await auth();
  if (!userId || !orgId) return null;

  const metadata = sessionClaims?.metadata as Record<string, string> | undefined;
  const dbUserIdFromMetadata = metadata?.db_user_id;

  // Fast path: metadata exists from webhook sync
  if (dbUserIdFromMetadata) {
    if (!(await isUserActive(dbUserIdFromMetadata))) return null;

    return {
      userId,
      orgId,
      role: (metadata?.role as UserRole) ?? 'architect',
      dbUserId: dbUserIdFromMetadata,
    };
  }

  // Slow path: DB lookup/bootstrap (when webhook hasn't synced yet)
  const db = getDb();

  // Try to find existing user
  const { data: existingUser } = await db
    .from('users')
    .select('id, role, is_active')
    .eq('clerk_user_id', userId)
    .eq('organization_id', orgId)
    .single();

  if (existingUser) {
    if (existingUser.is_active === false) {
      return null;
    }

    return {
      userId,
      orgId,
      role: existingUser.role as UserRole,
      dbUserId: existingUser.id,
    };
  }

  // Auto-create: first user in org = admin, rest = architect
  const { count } = await db
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  const role: UserRole = count === 0 ? 'admin' : 'architect';

  // Ensure organization exists
  const { data: existingOrg } = await db
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .single();

  if (!existingOrg) {
    await db.from('organizations').insert({
      id: orgId,
      name: orgId,
      slug: orgId,
    });
  }

  // Get user info from Clerk session for the insert
  let fullName = 'Usuario';
  let email = '';

  // Try session claims first (fastest)
  const claims = sessionClaims as Record<string, unknown>;
  if (claims?.name && typeof claims.name === 'string' && claims.name.trim()) {
    fullName = claims.name.trim();
  } else if (
    (typeof claims?.firstName === 'string' && claims.firstName) ||
    (typeof claims?.lastName === 'string' && claims.lastName)
  ) {
    const first = typeof claims.firstName === 'string' ? claims.firstName : '';
    const last = typeof claims.lastName === 'string' ? claims.lastName : '';
    fullName = `${first} ${last}`.trim() || 'Usuario';
  }
  if (claims?.email && typeof claims.email === 'string') {
    email = claims.email;
  }

  // If name is still default, fetch from Clerk API (slow but accurate)
  if (fullName === 'Usuario') {
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      fullName = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || 'Usuario';
      email = email || (clerkUser.emailAddresses?.[0]?.emailAddress ?? '');
    } catch (e) {
      console.error('Failed to fetch Clerk user for bootstrap:', e);
    }
  }

  const { data: newUser } = await db
    .from('users')
    .insert({
      clerk_user_id: userId,
      organization_id: orgId,
      role,
      full_name: fullName,
      email,
    })
    .select('id, role')
    .single();

  if (!newUser) return null;

  return {
    userId,
    orgId,
    role: newUser.role as UserRole,
    dbUserId: newUser.id,
  };
}

export function unauthorized() {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
}

export function deactivated() {
  return NextResponse.json(
    { error: 'Tu cuenta ha sido desactivada. Contacta al administrador.' },
    { status: 403 }
  );
}
