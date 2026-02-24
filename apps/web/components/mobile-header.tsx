'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { SidebarContent, navItems } from '@/components/sidebar';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

const EXTRA_TITLES: Record<string, string> = {
  '/receipts': 'Comprobantes',
};

function usePageTitle() {
  const pathname = usePathname();
  const match = navItems.find(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
  );
  if (match) return match.label;

  const extra = Object.entries(EXTRA_TITLES).find(([prefix]) => pathname.startsWith(prefix));
  return extra ? extra[1] : 'Agentect';
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const title = usePageTitle();

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center gap-4 border-b bg-background px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-m-2 p-2 text-muted-foreground"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="flex-1 text-sm font-semibold">{title}</div>

        <UserButton />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0 gap-0">
          {/* SheetTitle is visually hidden — Radix requires an accessible dialog title.
              The visible "Agentect" logo serves sighted users; screen readers get "Menú de navegación". */}
          <VisuallyHidden>
            <SheetTitle>Menú de navegación</SheetTitle>
          </VisuallyHidden>
          <div className="flex h-16 items-center px-6 border-b shrink-0">
            <h1 className="text-xl font-bold">Agentect</h1>
          </div>
          <SidebarContent onNavigate={() => setOpen(false)} showUserFooter={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
