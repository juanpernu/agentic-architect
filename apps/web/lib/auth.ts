import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { UserRole } from '@obralink/shared';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: UserRole;
  dbUserId: string;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId, orgId, sessionClaims } = await auth();
  if (!userId || !orgId) return null;

  const metadata = sessionClaims?.metadata as Record<string, string> | undefined;
  return {
    userId,
    orgId,
    role: (metadata?.role as UserRole) ?? 'architect',
    dbUserId: metadata?.db_user_id ?? '',
  };
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
