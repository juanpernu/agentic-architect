'use client';

import { useUser } from '@clerk/nextjs';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { UserRole } from '@architech/shared';

interface MeResponse {
  role: UserRole;
}

export function useCurrentUser() {
  const { user, isLoaded } = useUser();

  const clerkRole = user?.publicMetadata?.role as UserRole | undefined;

  // If Clerk metadata has role, use it (fast path from webhook sync).
  // Otherwise, fetch from our API (bootstrap path).
  const { data } = useSWR<MeResponse>(
    isLoaded && !clerkRole ? '/api/me' : null,
    fetcher
  );

  const role: UserRole = clerkRole ?? data?.role ?? 'architect';

  const fullName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Usuario'
    : 'Usuario';

  return {
    role,
    fullName,
    isLoaded: isLoaded && (!!clerkRole || !!data),
    isAdmin: role === 'admin',
    isAdminOrSupervisor: role === 'admin' || role === 'supervisor',
  };
}
