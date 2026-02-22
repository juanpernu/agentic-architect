'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Users, Landmark, CreditCard, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/use-current-user';

const tabs = [
  { href: '/settings/general', label: 'General', icon: Settings, roles: ['admin', 'supervisor', 'architect'] },
  { href: '/settings/users', label: 'Usuarios', icon: Users, roles: ['admin'] },
  { href: '/settings/banks', label: 'Bancos', icon: Landmark, roles: ['admin', 'supervisor'] },
  { href: '/settings/billing', label: 'Facturación', icon: CreditCard, roles: ['admin'] },
  { href: '/settings/administration', label: 'Administración', icon: ClipboardList, roles: ['admin'] },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, isLoaded } = useCurrentUser();

  if (!isLoaded) return null;

  const visibleTabs = tabs.filter((tab) => tab.roles.includes(role));

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu perfil, la configuración de la empresa y tus preferencias.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Vertical tabs */}
        <nav className="w-full lg:w-56 shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {visibleTabs.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                  'lg:rounded-l-none lg:border-l-4',
                  isActive
                    ? 'text-primary lg:border-l-primary bg-primary/5'
                    : 'text-muted-foreground lg:border-l-transparent hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 w-full min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
