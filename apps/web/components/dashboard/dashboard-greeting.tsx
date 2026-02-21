'use client';

import { useOrganization } from '@clerk/nextjs';
import { useCurrentUser } from '@/lib/use-current-user';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardGreeting() {
  const { fullName, isLoaded: isUserLoaded } = useCurrentUser();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();

  if (!isUserLoaded || !isOrgLoaded) {
    return (
      <div className="space-y-2 mb-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-56" />
      </div>
    );
  }

  const firstName = fullName.split(' ')[0] || 'Usuario';
  const orgName = organization?.name ?? '';

  return (
    <div className="mb-6">
      {orgName && (
        <p className="text-sm font-medium text-muted-foreground">{orgName}</p>
      )}
      <h1 className="text-2xl font-bold mt-0.5">
        Hola, {firstName}!
      </h1>
    </div>
  );
}
