'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Sparkles,
  FolderKanban,
  Calculator,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FAB_ACTIONS = [
  { label: 'Ingreso', icon: TrendingUp, href: '/administration/incomes?create=true' },
  { label: 'Egreso', icon: TrendingDown, href: '/administration/expenses?create=true' },
  { label: 'Presupuesto', icon: Calculator, href: '/budgets?create=true' },
  { label: 'Proyecto', icon: FolderKanban, href: '/projects?create=true' },
  { label: 'Comprobante', icon: Sparkles, href: '/upload' },
] as const;

const HIDDEN_PATTERNS = ['/upload', '/receipts/', '/settings/billing'];

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isHidden = HIDDEN_PATTERNS.some((p) =>
    p.endsWith('/') ? pathname.startsWith(p) : pathname === p
  );

  if (isHidden) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 md:hidden">
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 -z-10"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Speed dial actions */}
      <div className="flex flex-col-reverse items-end gap-3 mb-3">
        {FAB_ACTIONS.map((action, i) => (
          <Link
            key={action.label}
            href={action.href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 transition-all duration-200',
              open
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none'
            )}
            style={{
              transitionDelay: open ? `${i * 50}ms` : '0ms',
            }}
          >
            <span className="bg-card text-card-foreground text-sm font-medium px-3 py-1.5 rounded-full shadow-lg border border-border whitespace-nowrap">
              {action.label}
            </span>
            <span className="w-10 h-10 rounded-full bg-card text-foreground shadow-lg border border-border flex items-center justify-center shrink-0">
              <action.icon className="h-5 w-5" />
            </span>
          </Link>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg',
          'flex items-center justify-center transition-transform duration-200',
          'hover:shadow-xl active:scale-95',
          open && 'rotate-45'
        )}
        aria-label={open ? 'Cerrar menú rápido' : 'Abrir menú rápido'}
        aria-expanded={open}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
