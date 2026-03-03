'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, LayoutDashboard, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/use-current-user';
import { usePlan } from '@/lib/use-plan';
import { EmptyState } from '@/components/ui/empty-state';
import { PlanGatePage, AdministrationPreview } from '@/components/plan-gate-page';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingCards, LoadingTable } from '@/components/ui/loading-skeleton';

const tabs = [
  { href: '/administration', label: 'Resumen', icon: LayoutDashboard },
  { href: '/administration/incomes', label: 'Ingresos', icon: TrendingUp },
  { href: '/administration/expenses', label: 'Egresos', icon: TrendingDown },
  { href: '/administration/receipts', label: 'Comprobantes', icon: Receipt },
];

function AdministrationSkeleton() {
  return (
    <div className="space-y-6">
      <div className="-mx-4 md:-mx-8 -mt-2 px-4 md:px-8 pb-5 mb-2 border-b border-border bg-card">
        <div className="flex gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-[250px]" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
        </div>
      </div>
      <LoadingCards count={3} />
      <div className="rounded-lg border p-6">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[250px] w-full" />
      </div>
      <LoadingTable rows={5} />
    </div>
  );
}

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, isLoaded } = useCurrentUser();
  const { canViewAdministration, isLoading: isPlanLoading } = usePlan();

  if (!isLoaded) return null;

  // Architect cannot access
  if (role === 'architect') {
    return (
      <div className="p-6">
        <EmptyState
          icon={ShieldAlert}
          title="Acceso denegado"
          description="No tenes permisos para ver el modulo de administracion."
        />
      </div>
    );
  }

  // Show skeleton while plan loads to prevent API call leakage
  if (isPlanLoading) {
    return (
      <div className="animate-slide-up">
        <AdministrationSkeleton />
      </div>
    );
  }

  // Plan gate — covers all admin sub-routes
  if (!canViewAdministration) {
    return (
      <div className="animate-slide-up">
        <PlanGatePage
          title="Administración"
          description="Controlá el flujo financiero de todos tus proyectos."
          preview={<AdministrationPreview />}
          features={[
            'Flujo de caja mensual (ingresos vs egresos)',
            'Balance por proyecto',
            'Presupuestado vs ejecutado por rubro',
            'Gestión de ingresos y egresos',
          ]}
        >
          <AdministrationSkeleton />
        </PlanGatePage>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      {/* Header band */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Administracion</h1>
          <p className="text-muted-foreground mt-1">Gestiona los ingresos y egresos de tus obras</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                  isActive
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
