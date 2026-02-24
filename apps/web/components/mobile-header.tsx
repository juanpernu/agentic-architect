'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { SidebarContent, navItems } from '@/components/sidebar';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

function usePageTitle() {
  const pathname = usePathname();
  const match = navItems.find(
    (item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
  );
  return match?.label ?? 'Agentect';
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const title = usePageTitle();

  return (
    <div className="sticky top-0 z-40 flex items-center gap-4 border-b bg-background px-4 py-3 md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-m-2 p-2 text-muted-foreground"
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div className="flex-1 text-sm font-semibold">{title}</div>

      <UserButton />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={true} className="w-72 p-0">
          <VisuallyHidden>
            <SheetTitle>Menú de navegación</SheetTitle>
          </VisuallyHidden>
          <div className="flex h-16 items-center px-6 border-b">
            <h1 className="text-xl font-bold">Agentect</h1>
          </div>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
