'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Sparkles, Calculator, BarChart3, Landmark, Settings } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/use-current-user';
import { usePlan } from '@/lib/use-plan';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/role-constants';
import { Badge } from '@/components/ui/badge';

const navItems: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}> = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/upload', label: 'Escanear comprobante', icon: Sparkles },
  { href: '/budgets', label: 'Presupuestos', icon: Calculator },
  { href: '/administration', label: 'Administración', icon: Landmark, roles: ['admin', 'supervisor'] },
  { href: '/reports', label: 'Reportes', icon: BarChart3, roles: ['admin', 'supervisor'] },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role, fullName } = useCurrentUser();
  const { isFreePlan } = usePlan();

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === '/reports' && isFreePlan) return false;
    if (item.roles && !item.roles.includes(role)) return false;
    return true;
  });

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-xl font-bold">Agentect</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <UserButton />
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-sm font-medium truncate" title={fullName}>{fullName}</span>
            <Badge
              variant="secondary"
              className={cn('w-fit text-xs', ROLE_COLORS[role])}
            >
              {ROLE_LABELS[role]}
            </Badge>
          </div>
        </div>
      </div>
    </aside>
  );
}
