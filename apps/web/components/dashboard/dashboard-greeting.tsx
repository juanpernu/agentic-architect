'use client';

import { useOrganization } from '@clerk/nextjs';
import { useCurrentUser } from '@/lib/use-current-user';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardGreeting() {
  const { fullName, isLoaded: isUserLoaded } = useCurrentUser();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();

  if (!isUserLoaded || !isOrgLoaded) {
    return (
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-64" />
      </div>
    );
  }

  const firstName = fullName.split(' ')[0] || 'Usuario';
  const orgName = organization?.name ?? '';

  return (
    <div className="flex flex-col gap-1">
      {orgName && (
        <p className="text-sm font-medium text-muted-foreground">{orgName}</p>
      )}
      <h2 className="text-3xl font-bold tracking-tight">
        Hola, {firstName}!
      </h2>
    </div>
  );
}
