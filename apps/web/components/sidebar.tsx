'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Receipt, Upload, Settings } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/use-current-user';
import { Badge } from '@/components/ui/badge';
import type { UserRole } from '@architech/shared';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/receipts', label: 'Comprobantes', icon: Receipt },
  { href: '/upload', label: 'Cargar', icon: Upload },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  architect: 'Arquitecto',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  supervisor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  architect: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, role, fullName } = useCurrentUser();

  const visibleNavItems = navItems.filter(
    (item) => item.href !== '/settings' || isAdmin
  );

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-xl font-bold">Architech</h1>
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
            <span className="text-sm font-medium truncate">{fullName}</span>
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
