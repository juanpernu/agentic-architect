'use client';

import { useOrganization } from '@clerk/nextjs';
import { useCurrentUser } from '@/lib/use-current-user';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardGreeting() {
  const { isLoaded: isUserLoaded } = useCurrentUser();
  const { isLoaded: isOrgLoaded } = useOrganization();

  if (!isUserLoaded || !isOrgLoaded) {
    return (
      <div className="flex flex-col gap-1">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-80" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard Principal</h2>
      <p className="text-muted-foreground">Resumen general de obras y estado financiero.</p>
    </div>
  );
}
