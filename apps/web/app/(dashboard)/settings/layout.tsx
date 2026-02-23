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
      {/* Header band */}
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 md:px-8 pt-4 md:pt-6 pb-6 mb-6 border-b border-border bg-card space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Ajustes</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tu perfil, la configuración de la empresa y tus preferencias.
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => {
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
