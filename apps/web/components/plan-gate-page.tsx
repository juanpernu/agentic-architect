'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Sparkles, Check, ArrowLeft } from 'lucide-react';
import { usePlan } from '@/lib/use-plan';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface PlanGatePageProps {
  title: string;
  description: string;
  features: string[];
  children: ReactNode;
}

const NOOP = () => {};

export function PlanGatePage({
  title,
  description,
  features,
  children,
}: PlanGatePageProps) {
  const { isFreePlan, isLoading } = usePlan();

  if (isLoading || !isFreePlan) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="blur-sm opacity-50 pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      <Dialog open={true} onOpenChange={NOOP}>
        <DialogContent
          showCloseButton={false}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="sm:max-w-md"
        >
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">
              Desbloqueá {title}
            </DialogTitle>
            <DialogDescription>
              {description}
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-3 py-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button asChild className="w-full">
              <Link href="/settings/billing">Ver planes</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al panel
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
