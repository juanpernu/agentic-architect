'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Receipt, Upload, Settings } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/receipts', label: 'Comprobantes', icon: Receipt },
  { href: '/upload', label: 'Cargar', icon: Upload },
  { href: '/settings', label: 'Ajustes', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-xl font-bold">ObraLink</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
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
        <UserButton />
      </div>
    </aside>
  );
}
