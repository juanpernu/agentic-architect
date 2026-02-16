'use client';

import { useUser } from '@clerk/nextjs';
import type { UserRole } from '@architech/shared';

export function useCurrentUser() {
  const { user, isLoaded } = useUser();

  const role = (user?.publicMetadata?.role as UserRole) ?? 'architect';

  return {
    role,
    isLoaded,
    isAdmin: role === 'admin',
    isAdminOrSupervisor: role === 'admin' || role === 'supervisor',
  };
}
