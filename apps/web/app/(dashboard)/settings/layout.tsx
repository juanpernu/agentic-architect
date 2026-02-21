'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/use-current-user';
import { PageHeader } from '@/components/ui/page-header';

const tabs = [
  { href: '/settings/general', label: 'General', roles: ['admin', 'supervisor', 'architect'] },
  { href: '/settings/users', label: 'Usuarios', roles: ['admin'] },
  { href: '/settings/banks', label: 'Bancos', roles: ['admin', 'supervisor'] },
  { href: '/settings/billing', label: 'Facturación', roles: ['admin'] },
  { href: '/settings/administration', label: 'Administración', roles: ['admin'] },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, isLoaded } = useCurrentUser();

  if (!isLoaded) return null;

  const visibleTabs = tabs.filter((tab) => tab.roles.includes(role));

  return (
    <div className="p-6 animate-slide-up">
      <PageHeader title="Ajustes" description="Gestiona tu organización y equipo" />

      <div className="border-b mb-6">
        <nav className="flex gap-4 -mb-px">
          {visibleTabs.map((tab) => (
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
