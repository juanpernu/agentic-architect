'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/use-current-user';
import { usePlan } from '@/lib/use-plan';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { UpgradeBanner } from '@/components/upgrade-banner';

const tabs = [
  { href: '/administration', label: 'Resumen' },
  { href: '/administration/incomes', label: 'Ingresos' },
  { href: '/administration/expenses', label: 'Egresos' },
  { href: '/administration/receipts', label: 'Comprobantes' },
];

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, isLoaded } = useCurrentUser();
  const { isFreePlan } = usePlan();

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

  // Free plan cannot access
  if (isFreePlan) {
    return (
      <div className="p-6 animate-slide-up">
        <PageHeader title="Administracion" description="Gestiona los ingresos y egresos de tus obras" />
        <UpgradeBanner
          message="El modulo de Administracion esta disponible en los planes Advance y Enterprise."
        />
      </div>
    );
  }

  return (
    <div className="p-6 animate-slide-up">
      <PageHeader title="Administracion" description="Gestiona los ingresos y egresos de tus obras" />
      <div className="border-b mb-6">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'px-1 pb-3 text-sm font-medium border-b-2 transition-colors',
                pathname === tab.href
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
