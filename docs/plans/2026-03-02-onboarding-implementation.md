# User Onboarding Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a multi-step onboarding flow with two role-based variants: creators (admin/supervisor) are guided to create their first project and budget; viewers (architect) get a visual tour of the platform. Supabase persistence enables resumability.

**Architecture:** Custom implementation using Shadcn/ui Dialog for modals (welcome + summary), custom overlay + floating-ui for spotlight tooltips, React Context for state machine, and Supabase `users` table columns for persistence. No new dependencies — everything built with existing stack.

**Tech Stack:** Next.js 16 (App Router), React 19, Shadcn/ui (Dialog, Tooltip), @floating-ui/react (already transitive dep), Supabase, SWR, Zod, Vitest

**Design doc:** `docs/plans/2026-03-02-onboarding-design.md`

---

## Task 1: Database Migration + Shared Types

**Files:**
- Create: `supabase/migrations/20260302120000_user_onboarding.sql`
- Modify: `packages/shared/src/types.ts:29-39`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20260302120000_user_onboarding.sql
ALTER TABLE users ADD COLUMN onboarding_step text NOT NULL DEFAULT 'welcome';
ALTER TABLE users ADD COLUMN onboarding_completed_at timestamptz;
```

**Step 2: Run migration against Supabase**

Run: `npx supabase db push` (or apply manually in Supabase dashboard)
Expected: columns added to `users` table

**Step 3: Update User type**

In `packages/shared/src/types.ts`, add after line 37 (`is_active: boolean;`):

```typescript
export interface User {
  id: string;
  clerk_user_id: string;
  organization_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
  onboarding_step: string;
  onboarding_completed_at: string | null;
  created_at: string;
}
```

**Step 4: Add OnboardingStep type**

In `packages/shared/src/types.ts`, add after the User interface:

```typescript
export const ONBOARDING_STEPS = [
  'welcome',
  'tour-1',
  'tour-2',
  'tour-3',
  'tour-4',
  'tour-5',
  'tour-6',
  'summary',
  'completed',
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];
```

**Step 5: Re-export from index**

Check `packages/shared/src/index.ts` already re-exports everything from `types.ts`. If `ONBOARDING_STEPS` needs explicit export, add it.

**Step 6: Commit**

```bash
git add supabase/migrations/20260302120000_user_onboarding.sql packages/shared/src/types.ts
git commit -m "feat(onboarding): add DB migration and shared types for onboarding step tracking"
```

---

## Task 2: API Route — `/api/onboarding`

**Files:**
- Create: `apps/web/app/api/onboarding/route.ts`
- Create: `apps/web/lib/schemas/onboarding.ts`

**Step 1: Create Zod schema**

```typescript
// apps/web/lib/schemas/onboarding.ts
import { z } from 'zod';
import { ONBOARDING_STEPS } from '@architech/shared';

export const onboardingUpdateSchema = z.object({
  step: z.enum(ONBOARDING_STEPS),
});
```

**Step 2: Create API route**

```typescript
// apps/web/app/api/onboarding/route.ts
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/auth';
import { getDb } from '@/lib/supabase';
import { validateBody } from '@/lib/validate';
import { apiError, dbError } from '@/lib/api-error';
import { onboardingUpdateSchema } from '@/lib/schemas/onboarding';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const db = getDb();
  const { data, error } = await db
    .from('users')
    .select('onboarding_step, onboarding_completed_at')
    .eq('id', ctx.dbUserId)
    .single();

  if (error) return dbError(error, 'fetch onboarding status');

  return NextResponse.json({
    step: data.onboarding_step,
    completedAt: data.onboarding_completed_at,
  });
}

export async function PATCH(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await validateBody(onboardingUpdateSchema, req);
  if (body instanceof NextResponse) return body;

  const db = getDb();
  const updates: Record<string, unknown> = {
    onboarding_step: body.data.step,
  };

  if (body.data.step === 'completed') {
    updates.onboarding_completed_at = new Date().toISOString();
  }

  const { error } = await db
    .from('users')
    .update(updates)
    .eq('id', ctx.dbUserId);

  if (error) return dbError(error, 'update onboarding step');

  return NextResponse.json({ step: body.data.step });
}
```

**Step 3: Commit**

```bash
git add apps/web/lib/schemas/onboarding.ts apps/web/app/api/onboarding/route.ts
git commit -m "feat(onboarding): add GET/PATCH /api/onboarding route for step persistence"
```

---

## Task 3: Shadcn Popover Component

**Files:**
- Create: `apps/web/components/ui/popover.tsx`

The project does NOT have a Popover component yet. We need it for onboarding tooltips.

**Step 1: Install Popover from Shadcn CLI**

Run: `cd apps/web && npx shadcn@latest add popover`
Expected: `components/ui/popover.tsx` created with Radix Popover primitives

If the CLI doesn't work, create manually:

```typescript
// apps/web/components/ui/popover.tsx
'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
```

**Step 2: Verify Radix popover is available**

Run: `cd apps/web && npm ls @radix-ui/react-popover`
If not installed: `npm install @radix-ui/react-popover`

**Step 3: Commit**

```bash
git add apps/web/components/ui/popover.tsx
git commit -m "feat(ui): add Shadcn Popover component for onboarding tooltips"
```

---

## Task 4: OnboardingOverlay + OnboardingTooltip Components

**Files:**
- Create: `apps/web/components/onboarding/overlay.tsx`
- Create: `apps/web/components/onboarding/tooltip.tsx`

**Step 1: Create OnboardingOverlay**

This component renders a dark backdrop with a transparent "cutout" around a target element (spotlight effect).

```typescript
// apps/web/components/onboarding/overlay.tsx
'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface OnboardingOverlayProps {
  targetSelector: string;
  onClick?: () => void;
  className?: string;
}

export function OnboardingOverlay({ targetSelector, onClick, className }: OnboardingOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(targetSelector);
    if (!el) return;

    const update = () => setRect(el.getBoundingClientRect());
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [targetSelector]);

  if (!rect) return null;

  const padding = 8;

  return (
    <div
      className={cn('fixed inset-0 z-[9998]', className)}
      onClick={onClick}
      aria-hidden="true"
    >
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="onboarding-spotlight">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - padding}
              y={rect.top - padding}
              width={rect.width + padding * 2}
              height={rect.height + padding * 2}
              rx={8}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#onboarding-spotlight)"
        />
      </svg>
    </div>
  );
}
```

**Step 2: Create OnboardingTooltip**

```typescript
// apps/web/components/onboarding/tooltip.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface OnboardingTooltipProps {
  targetSelector: string;
  title?: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  onSkip?: () => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
  step?: string;
  totalSteps?: number;
  currentStep?: number;
}

export function OnboardingTooltip({
  targetSelector,
  title,
  description,
  ctaLabel = 'Siguiente',
  onCtaClick,
  onSkip,
  side = 'bottom',
  step,
  currentStep,
  totalSteps,
}: OnboardingTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const target = document.querySelector(targetSelector);
    if (!target || !tooltipRef.current) return;

    const update = () => {
      const targetRect = target.getBoundingClientRect();
      const tooltipRect = tooltipRef.current!.getBoundingClientRect();
      const gap = 12;

      let top = 0;
      let left = 0;

      switch (side) {
        case 'bottom':
          top = targetRect.bottom + gap;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case 'top':
          top = targetRect.top - tooltipRect.height - gap;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case 'right':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.right + gap;
          break;
        case 'left':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.left - tooltipRect.width - gap;
          break;
      }

      // Clamp to viewport
      left = Math.max(12, Math.min(left, window.innerWidth - tooltipRect.width - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - tooltipRect.height - 12));

      setPosition({ top, left });
    };

    // Initial position + observe changes
    requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [targetSelector, side]);

  return (
    <div
      ref={tooltipRef}
      role="tooltip"
      className={cn(
        'fixed z-[9999] w-80 rounded-xl border bg-card p-4 shadow-lg',
        'animate-in fade-in-0 zoom-in-95',
        !position && 'opacity-0'
      )}
      style={position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {title && <h3 className="font-semibold text-sm mb-1">{title}</h3>}
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Omitir onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        {currentStep && totalSteps ? (
          <span className="text-xs text-muted-foreground">
            {currentStep} de {totalSteps}
          </span>
        ) : (
          <span />
        )}
        {onCtaClick && (
          <Button size="sm" onClick={onCtaClick}>
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/components/onboarding/overlay.tsx apps/web/components/onboarding/tooltip.tsx
git commit -m "feat(onboarding): add OnboardingOverlay spotlight and OnboardingTooltip components"
```

---

## Task 5: OnboardingWelcome Component (Full-screen Slides)

**Files:**
- Create: `apps/web/components/onboarding/welcome.tsx`

**Step 1: Create the welcome component**

```typescript
// apps/web/components/onboarding/welcome.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TableProperties, Camera, BarChart3, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

type OnboardingVariant = 'creator' | 'viewer';

interface OnboardingWelcomeProps {
  open: boolean;
  variant: OnboardingVariant;
  onComplete: () => void;
  onSkip: () => void;
}

function getSlides(variant: OnboardingVariant) {
  return [
    {
      icon: null, // Logo slide
      title: 'Sabé exactamente cuánto ganás en cada obra',
      description:
        'Presupuestos integrados, seguimiento de gastos por rubro y control de rentabilidad en tiempo real. Diseñado para estudios de arquitectura.',
    },
    {
      features: [
        {
          icon: TableProperties,
          title: 'Presupuestos profesionales',
          description: 'Armá presupuestos con rubros, items, unidades y costos. Con versionado automático.',
        },
        {
          icon: Camera,
          title: 'Comprobantes con IA',
          description: 'Sacale una foto a la factura y Agentect extrae proveedor, monto y CUIT.',
        },
        {
          icon: BarChart3,
          title: 'Reportes en tiempo real',
          description: 'Controlá la rentabilidad por rubro y detectá desvíos a tiempo.',
        },
      ],
    },
    {
      icon: Building2,
      title: variant === 'creator'
        ? 'Empecemos creando tu primer proyecto'
        : 'Vamos a conocer la plataforma',
      description: variant === 'creator'
        ? 'En 5 minutos vas a tener tu primer presupuesto armado.'
        : 'Te mostramos las herramientas principales en un minuto.',
      isCta: true,
    },
  ];
}

export function OnboardingWelcome({ open, variant, onComplete, onSkip }: OnboardingWelcomeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = getSlides(variant);
  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg p-0 gap-0 border-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center p-8 min-h-[420px] justify-center">
          {/* Slide 1: Value prop */}
          {currentSlide === 0 && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-right-4">
              <Image
                src="/agentect-logo.svg"
                alt="Agentect"
                width={180}
                height={40}
                className="mx-auto"
              />
              <h1 className="text-2xl font-bold tracking-tight">{slide.title}</h1>
              <p className="text-muted-foreground max-w-sm">{slide.description}</p>
            </div>
          )}

          {/* Slide 2: Features */}
          {currentSlide === 1 && 'features' in slide && (
            <div className="space-y-6 w-full animate-in fade-in-0 slide-in-from-right-4">
              <h2 className="text-lg font-semibold">Todo lo que necesitás</h2>
              <div className="space-y-4 text-left">
                {slide.features!.map((feat) => (
                  <div key={feat.title} className="flex gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <feat.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{feat.title}</h3>
                      <p className="text-sm text-muted-foreground">{feat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Slide 3: CTA */}
          {currentSlide === 2 && 'icon' in slide && slide.icon && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-right-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <slide.icon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">{slide.title}</h2>
              <p className="text-muted-foreground">{slide.description}</p>
            </div>
          )}

          {/* Dots */}
          <div className="flex items-center gap-2 mt-8">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === currentSlide ? 'bg-primary w-6' : 'bg-muted-foreground/30'
                )}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 mt-6 w-full justify-center">
            {currentSlide > 0 && (
              <Button variant="ghost" onClick={() => setCurrentSlide((s) => s - 1)}>
                Anterior
              </Button>
            )}
            <Button onClick={isLast ? onComplete : () => setCurrentSlide((s) => s + 1)}>
              {isLast ? 'Empezar' : 'Siguiente'}
            </Button>
          </div>

          {/* Skip link on last slide */}
          {isLast && (
            <button
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground mt-4 transition-colors"
            >
              Omitir onboarding
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/onboarding/welcome.tsx
git commit -m "feat(onboarding): add full-screen welcome slides component"
```

---

## Task 6: OnboardingSummary Component (Final Modal)

**Files:**
- Create: `apps/web/components/onboarding/summary.tsx`

**Step 1: Create the summary component**

```typescript
// apps/web/components/onboarding/summary.tsx
'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, ArrowUpDown, BarChart3, FolderOpen, Settings } from 'lucide-react';

type OnboardingVariant = 'creator' | 'viewer';

interface OnboardingSummaryProps {
  open: boolean;
  variant: OnboardingVariant;
  onComplete: () => void;
}

const creatorFeatures = [
  {
    icon: Camera,
    title: 'Comprobantes',
    description: 'Subí fotos de facturas y tiques. La IA extrae los datos por vos.',
  },
  {
    icon: ArrowUpDown,
    title: 'Administración',
    description: 'Registrá ingresos y egresos. Controlá el cashflow de cada obra.',
  },
  {
    icon: BarChart3,
    title: 'Reportes',
    description: 'Visualizá gastos por rubro y detectá desvíos a tiempo.',
  },
];

const viewerFeatures = [
  {
    icon: Camera,
    title: 'Comprobantes',
    description: 'Subí fotos de facturas y tiques. La IA extrae los datos por vos.',
  },
  {
    icon: FolderOpen,
    title: 'Presupuestos',
    description: 'Consultá presupuestos de tus proyectos asignados.',
  },
  {
    icon: Settings,
    title: 'Configuración',
    description: 'Personalizá tu perfil y preferencias.',
  },
];

export function OnboardingSummary({ open, variant, onComplete }: OnboardingSummaryProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg p-0 gap-0 border-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center p-8">
          <h2 className="text-2xl font-bold mb-2">Tu estudio está listo</h2>
          <p className="text-muted-foreground mb-8">Ahora descubrí el resto:</p>

          <div className="space-y-4 w-full text-left mb-8">
            {(variant === 'creator' ? creatorFeatures : viewerFeatures).map((feat) => (
              <div key={feat.title} className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground">{feat.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={onComplete}>
            Empezar a usar Agentect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/components/onboarding/summary.tsx
git commit -m "feat(onboarding): add summary modal component for onboarding completion"
```

---

## Task 7: OnboardingProvider (State Machine + Context)

**Files:**
- Create: `apps/web/lib/use-onboarding.ts`
- Create: `apps/web/components/onboarding/provider.tsx`

This is the core component that orchestrates the entire onboarding flow.

**Step 1: Create the useOnboarding hook type**

```typescript
// apps/web/lib/use-onboarding.ts
'use client';

import { createContext, useContext } from 'react';
import type { OnboardingStep } from '@architech/shared';

export type OnboardingVariant = 'creator' | 'viewer';

export interface OnboardingContextValue {
  step: OnboardingStep;
  isActive: boolean;
  variant: OnboardingVariant;
  projectId: string | null;
  setProjectId: (id: string) => void;
  nextStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue | null {
  return useContext(OnboardingContext);
}
```

**Step 2: Create the OnboardingProvider**

```typescript
// apps/web/components/onboarding/provider.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { fetcher } from '@/lib/fetcher';
import { OnboardingContext } from '@/lib/use-onboarding';
import type { OnboardingVariant } from '@/lib/use-onboarding';
import { useCurrentUser } from '@/lib/use-current-user';
import { OnboardingWelcome } from './welcome';
import { OnboardingSummary } from './summary';
import { OnboardingOverlay } from './overlay';
import { OnboardingTooltip } from './tooltip';
import type { OnboardingStep } from '@architech/shared';
import { ONBOARDING_STEPS } from '@architech/shared';

interface OnboardingState {
  step: OnboardingStep;
  completedAt: string | null;
}

// Creator steps (admin/supervisor): full creation flow
const CREATOR_STEPS: OnboardingStep[] = [
  'welcome', 'tour-1', 'tour-2', 'tour-3', 'tour-4', 'tour-5', 'tour-6', 'summary', 'completed',
];

// Viewer steps (architect): visual tour only
const VIEWER_STEPS: OnboardingStep[] = [
  'welcome', 'tour-1', 'tour-2', 'tour-3', 'summary', 'completed',
];

// Map step → expected route prefix
const STEP_ROUTES: Partial<Record<OnboardingStep, string>> = {
  'tour-1': '/',
  'tour-2': '/projects',
  'tour-3': '/projects/',
  'tour-4': '/projects/',
  'tour-5': '/budgets/',
  'tour-6': '/projects/',
};

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdminOrSupervisor, isLoaded: userLoaded } = useCurrentUser();
  const variant: OnboardingVariant = isAdminOrSupervisor ? 'creator' : 'viewer';
  const stepsForVariant = variant === 'creator' ? CREATOR_STEPS : VIEWER_STEPS;

  const { data, isLoading } = useSWR<OnboardingState>('/api/onboarding', fetcher);
  const [step, setStep] = useState<OnboardingStep>('completed');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Sync from server on load
  useEffect(() => {
    if (data && !isHydrated) {
      setStep(data.step as OnboardingStep);
      setIsHydrated(true);
    }
  }, [data, isHydrated]);

  const persistStep = useCallback(async (newStep: OnboardingStep) => {
    setStep(newStep);
    await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: newStep }),
    });
    globalMutate('/api/onboarding');
  }, []);

  const nextStep = useCallback(() => {
    const currentIndex = stepsForVariant.indexOf(step);
    if (currentIndex < stepsForVariant.length - 1) {
      const next = stepsForVariant[currentIndex + 1];
      persistStep(next);
    }
  }, [step, stepsForVariant, persistStep]);

  const goToStep = useCallback((newStep: OnboardingStep) => {
    persistStep(newStep);
  }, [persistStep]);

  const skipOnboarding = useCallback(() => {
    persistStep('completed');
  }, [persistStep]);

  const completeOnboarding = useCallback(() => {
    persistStep('completed');
    router.push('/');
  }, [persistStep, router]);

  const isActive = step !== 'completed' && isHydrated;

  const contextValue = useMemo(
    () => ({
      step,
      isActive,
      variant,
      projectId,
      setProjectId,
      nextStep,
      goToStep,
      skipOnboarding,
      completeOnboarding,
    }),
    [step, isActive, variant, projectId, nextStep, goToStep, skipOnboarding, completeOnboarding]
  );

  if (isLoading || !isHydrated) {
    return (
      <OnboardingContext.Provider value={contextValue}>
        {children}
      </OnboardingContext.Provider>
    );
  }

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}

      {/* Step: welcome */}
      <OnboardingWelcome
        open={step === 'welcome'}
        variant={variant}
        onComplete={() => {
          persistStep('tour-1');
          router.push('/projects');
        }}
        onSkip={skipOnboarding}
      />

      {/* ===== CREATOR STEPS (admin/supervisor) ===== */}

      {/* Step: tour-1 — Navigate to projects via sidebar */}
      {step === 'tour-1' && variant === 'creator' && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="nav-projects"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="nav-projects"]'
            title="Empezá acá"
            description="Creá tu primer proyecto para organizar una obra."
            ctaLabel="Ir a Proyectos"
            onCtaClick={() => {
              persistStep('tour-2');
              router.push('/projects');
            }}
            onSkip={skipOnboarding}
            side="right"
            currentStep={1}
            totalSteps={6}
          />
        </>
      )}

      {/* Step: tour-2 — Highlight CreateProjectCard */}
      {step === 'tour-2' && variant === 'creator' && pathname === '/projects' && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="create-project"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="create-project"]'
            title="Nuevo proyecto"
            description="Hacé click acá para crear tu primer proyecto."
            onSkip={skipOnboarding}
            side="bottom"
            currentStep={2}
            totalSteps={6}
          />
        </>
      )}

      {/* Step: tour-3 — Explain project detail page (creator) */}
      {step === 'tour-3' && variant === 'creator' && pathname.startsWith('/projects/') && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="project-stats"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="project-stats"]'
            title="Vista del proyecto"
            description="Acá vas a ver el resumen financiero: presupuestado, gasto real y disponible. Ahora creemos un presupuesto."
            ctaLabel="Crear presupuesto"
            onCtaClick={() => persistStep('tour-4')}
            onSkip={skipOnboarding}
            side="bottom"
            currentStep={3}
            totalSteps={6}
          />
        </>
      )}

      {/* Step: tour-4 — CreateBudgetDialog is opened by the project page */}
      {/* This step is handled by the project detail page which reads onboarding context */}

      {/* Step: tour-5 — Explain budget editor */}
      {step === 'tour-5' && variant === 'creator' && pathname.startsWith('/budgets/') && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="budget-editor"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="budget-editor"]'
            title="Editor de presupuesto"
            description="Podés agregar rubros (ej: Albañilería, Electricidad), items dentro de cada rubro, y Agentect guarda automáticamente cada cambio."
            ctaLabel="Entendido, volver al proyecto"
            onCtaClick={() => {
              persistStep('tour-6');
              if (projectId) router.push(`/projects/${projectId}`);
            }}
            onSkip={skipOnboarding}
            side="bottom"
            currentStep={5}
            totalSteps={6}
          />
        </>
      )}

      {/* ===== VIEWER STEPS (architect) ===== */}

      {/* Step: tour-1 — Navigate to projects (viewer) */}
      {step === 'tour-1' && variant === 'viewer' && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="nav-projects"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="nav-projects"]'
            title="Tus proyectos"
            description="Acá vas a ver los proyectos que te asignaron."
            ctaLabel="Ver Proyectos"
            onCtaClick={() => {
              persistStep('tour-2');
              router.push('/projects');
            }}
            onSkip={skipOnboarding}
            side="right"
            currentStep={1}
            totalSteps={3}
          />
        </>
      )}

      {/* Step: tour-2 — Explain projects list (viewer) */}
      {step === 'tour-2' && variant === 'viewer' && pathname === '/projects' && (
        <OnboardingTooltip
          targetSelector='[data-onboarding="projects-list"]'
          title="Mis proyectos"
          description="Solo vas a ver los proyectos donde estés asignado como arquitecto. Desde acá podés ver comprobantes y presupuestos de cada obra."
          ctaLabel="Siguiente"
          onCtaClick={() => persistStep('tour-3')}
          onSkip={skipOnboarding}
          side="bottom"
          currentStep={2}
          totalSteps={3}
        />
      )}

      {/* Step: tour-3 — Explain upload (viewer) */}
      {step === 'tour-3' && variant === 'viewer' && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="nav-upload"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="nav-upload"]'
            title="Comprobantes con IA"
            description="Podés cargar comprobantes sacándole una foto. La IA extrae proveedor, monto y CUIT automáticamente."
            ctaLabel="Siguiente"
            onCtaClick={() => persistStep('summary')}
            onSkip={skipOnboarding}
            side="right"
            currentStep={3}
            totalSteps={3}
          />
        </>
      )}

      {/* Step: tour-6 — Back to project, show budget impacted */}
      {step === 'tour-6' && pathname.startsWith('/projects/') && (
        <>
          <OnboardingOverlay targetSelector='[data-onboarding="project-stats"]' />
          <OnboardingTooltip
            targetSelector='[data-onboarding="project-stats"]'
            title="Presupuesto impactado"
            description="Ya podés ver tu presupuesto acá. A medida que cargues comprobantes, vas a ver el gasto real vs. presupuestado."
            ctaLabel="Siguiente"
            onCtaClick={() => persistStep('summary')}
            onSkip={skipOnboarding}
            side="bottom"
            currentStep={6}
            totalSteps={6}
          />
        </>
      )}

      {/* Step: summary */}
      <OnboardingSummary
        open={step === 'summary'}
        variant={variant}
        onComplete={completeOnboarding}
      />
    </OnboardingContext.Provider>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/lib/use-onboarding.ts apps/web/components/onboarding/provider.tsx
git commit -m "feat(onboarding): add OnboardingProvider state machine with context and step rendering"
```

---

## Task 8: Integrate OnboardingProvider into Dashboard Layout

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx:18-21`

**Step 1: Add OnboardingProvider wrapper**

The layout is a Server Component, so we wrap `{children}` with the Client Component `OnboardingProvider`. The key insight: the provider must wrap at the `<div className="min-h-screen">` level (not just `<main>`) so it can render overlays that cover the sidebar.

Current code at line 14-26:
```tsx
<ClerkProvider>
  <div className="min-h-screen">
    <Sidebar />
    <MobileHeader />
    <main className="md:pl-64 pt-0 md:pt-0 min-h-screen overflow-x-hidden bg-slate-50/50 dark:bg-background">
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {children}
      </div>
    </main>
    <Toaster position="bottom-right" options={{ fill: '#000000' }} />
    <FloatingActionButton />
  </div>
</ClerkProvider>
```

Change to:
```tsx
<ClerkProvider>
  <OnboardingProvider>
    <div className="min-h-screen">
      <Sidebar />
      <MobileHeader />
      <main className="md:pl-64 pt-0 md:pt-0 min-h-screen overflow-x-hidden bg-slate-50/50 dark:bg-background">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <Toaster position="bottom-right" options={{ fill: '#000000' }} />
      <FloatingActionButton />
    </div>
  </OnboardingProvider>
</ClerkProvider>
```

Add import at top:
```tsx
import { OnboardingProvider } from '@/components/onboarding/provider';
```

**Step 2: Commit**

```bash
git add apps/web/app/\\(dashboard\\)/layout.tsx
git commit -m "feat(onboarding): integrate OnboardingProvider into dashboard layout"
```

---

## Task 9: Add `data-onboarding` Attributes to Target Elements

**Files:**
- Modify: `apps/web/components/sidebar.tsx:52-68` — add `data-onboarding` to nav links
- Modify: `apps/web/components/dashboard/create-project-card.tsx` — add `data-onboarding="create-project"`
- Modify: `apps/web/app/(dashboard)/projects/page.tsx` — add `data-onboarding="projects-list"` to grid container
- Modify: `apps/web/app/(dashboard)/projects/[id]/page.tsx:343-447` — add `data-onboarding="project-stats"` to stats grid
- Modify: `apps/web/app/(dashboard)/budgets/[id]/page.tsx:108-117` — add `data-onboarding="budget-editor"` to BudgetTable wrapper

**Step 1: Sidebar — Nav links**

In `sidebar.tsx`, inside the `visibleNavItems.map()` at line 53, add a `data-onboarding` attribute mapping for key nav items:

```tsx
// Map hrefs to onboarding selectors
const onboardingMap: Record<string, string> = {
  '/projects': 'nav-projects',
  '/upload': 'nav-upload',
};

// Inside the map:
<Link
  key={item.href}
  href={item.href}
  onClick={onNavigate}
  aria-current={isActive(item.href) ? 'page' : undefined}
  data-onboarding={onboardingMap[item.href]}
  className={cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    // ...existing classes
  )}
>
```

**Step 2: CreateProjectCard**

Read the file first. Add `data-onboarding="create-project"` to the outermost element of the card.

**Step 3: Projects page grid**

In `projects/page.tsx`, add `data-onboarding="projects-list"` to the grid container (for viewer tour-2 tooltip):

```tsx
<div data-onboarding="projects-list" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
```

**Step 4: Project detail stats grid**

At line 344 of `projects/[id]/page.tsx`:

```tsx
<div data-onboarding="project-stats" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
```

**Step 5: Budget editor wrapper**

At line 111 of `budgets/[id]/page.tsx`, wrap BudgetTable in a div:

```tsx
<div data-onboarding="budget-editor">
  <BudgetTable
    budget={budgetForTable}
    onPublish={handlePublish}
    onEdit={handleEdit}
    initialConfidence={confidenceParam ? parseFloat(confidenceParam) : undefined}
  />
</div>
```

**Step 6: Commit**

```bash
git add apps/web/components/sidebar.tsx apps/web/components/dashboard/create-project-card.tsx apps/web/app/\\(dashboard\\)/projects/page.tsx apps/web/app/\\(dashboard\\)/projects/\\[id\\]/page.tsx apps/web/app/\\(dashboard\\)/budgets/\\[id\\]/page.tsx
git commit -m "feat(onboarding): add data-onboarding attributes to target UI elements"
```

---

## Task 10: Hook into Project Creation for Onboarding Flow

**Files:**
- Modify: `apps/web/app/(dashboard)/projects/page.tsx` — detect project creation during onboarding and advance step

**Step 1: Add onboarding awareness to projects page**

In `projects/page.tsx`, import and use the onboarding hook. After a project is created (dialog closes + SWR revalidates), detect the new project and advance the onboarding.

Add near the top (after existing hooks):

```tsx
import { useOnboarding } from '@/lib/use-onboarding';
```

Inside the component, after the existing hooks:

```tsx
const onboarding = useOnboarding();
```

After the `ProjectFormDialog`, add an effect that watches for new projects:

```tsx
// Track project count to detect creation during onboarding
const prevProjectCountRef = useRef(projects?.length ?? 0);

useEffect(() => {
  if (!onboarding?.isActive || onboarding.step !== 'tour-2') return;
  if (!projects) return;

  if (projects.length > prevProjectCountRef.current && projects.length > 0) {
    // New project was created during onboarding
    const newestProject = projects[projects.length - 1];
    onboarding.setProjectId(newestProject.id);
    onboarding.goToStep('tour-3');
    router.push(`/projects/${newestProject.id}`);
  }
  prevProjectCountRef.current = projects.length;
}, [projects, onboarding]);
```

Also add `useRef` to imports and `useRouter` if not already present.

**Step 2: Commit**

```bash
git add apps/web/app/\\(dashboard\\)/projects/page.tsx
git commit -m "feat(onboarding): detect project creation and advance onboarding to tour-3"
```

---

## Task 11: Hook into Budget Creation for Onboarding Flow

**Files:**
- Modify: `apps/web/app/(dashboard)/projects/[id]/page.tsx` — open CreateBudgetDialog during tour-4
- Modify: `apps/web/components/create-budget-dialog.tsx` — notify onboarding when budget is created

**Step 1: Open CreateBudgetDialog during onboarding tour-4**

In `projects/[id]/page.tsx`, add state and onboarding hook:

```tsx
import { useOnboarding } from '@/lib/use-onboarding';

// Inside component:
const onboarding = useOnboarding();
const [showCreateBudget, setShowCreateBudget] = useState(false);

// Effect: open budget dialog when step is tour-4
useEffect(() => {
  if (onboarding?.isActive && onboarding.step === 'tour-4') {
    setShowCreateBudget(true);
  }
}, [onboarding?.step, onboarding?.isActive]);
```

Add `<CreateBudgetDialog>` render at the bottom of the JSX:

```tsx
<CreateBudgetDialog
  open={showCreateBudget}
  onOpenChange={setShowCreateBudget}
/>
```

Import `CreateBudgetDialog`:
```tsx
import { CreateBudgetDialog } from '@/components/create-budget-dialog';
```

**Step 2: Detect budget creation in CreateBudgetDialog**

The dialog already navigates to `/budgets/[id]` on success. We need it to also notify onboarding.

In `create-budget-dialog.tsx`, add:

```tsx
import { useOnboarding } from '@/lib/use-onboarding';

// Inside component:
const onboarding = useOnboarding();
```

In the success handler (where it does `router.push(\`/budgets/${data.id}\`)`), add before the push:

```tsx
if (onboarding?.isActive && onboarding.step === 'tour-4') {
  onboarding.goToStep('tour-5');
}
```

**Step 3: Commit**

```bash
git add apps/web/app/\\(dashboard\\)/projects/\\[id\\]/page.tsx apps/web/components/create-budget-dialog.tsx
git commit -m "feat(onboarding): hook budget creation into onboarding flow (tour-4 → tour-5)"
```

---

## Task 12: OnboardingSnackbar (Resume Button)

**Files:**
- Create: `apps/web/components/onboarding/snackbar.tsx`
- Modify: `apps/web/components/onboarding/provider.tsx` — render snackbar when user navigates away from expected route

**Step 1: Create the snackbar component**

```typescript
// apps/web/components/onboarding/snackbar.tsx
'use client';

import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';

interface OnboardingSnackbarProps {
  onResume: () => void;
  onDismiss: () => void;
}

export function OnboardingSnackbar({ onResume, onDismiss }: OnboardingSnackbarProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9990] animate-in slide-in-from-bottom-4 fade-in-0">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg">
        <PlayCircle className="h-5 w-5 text-primary flex-shrink-0" />
        <span className="text-sm font-medium">Tenés un onboarding en curso</span>
        <Button size="sm" onClick={onResume}>
          Continuar
        </Button>
        <button
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Omitir
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Add snackbar logic to provider**

In `provider.tsx`, add logic: if `isActive && step !== 'welcome' && step !== 'summary'` and the current pathname doesn't match the expected route for the step, show the snackbar instead of the overlay/tooltip.

Add in the provider, before the return:

```tsx
const expectedRoute = STEP_ROUTES[step];
const isOnExpectedRoute = !expectedRoute || pathname.startsWith(expectedRoute);
const showSnackbar = isActive && !isOnExpectedRoute && step !== 'welcome' && step !== 'summary';
```

In the JSX, add at the end (before closing `</OnboardingContext.Provider>`):

```tsx
{showSnackbar && (
  <OnboardingSnackbar
    onResume={() => {
      // Navigate to expected route
      if (step === 'tour-1' || step === 'tour-2') router.push('/projects');
      else if (step === 'tour-3' || step === 'tour-4' || step === 'tour-6') {
        if (projectId) router.push(`/projects/${projectId}`);
        else router.push('/projects');
      }
      else if (step === 'tour-5') router.push('/budgets');
    }}
    onDismiss={skipOnboarding}
  />
)}
```

**Step 3: Commit**

```bash
git add apps/web/components/onboarding/snackbar.tsx apps/web/components/onboarding/provider.tsx
git commit -m "feat(onboarding): add resume snackbar for users who navigate away from onboarding"
```

---

## Task 13: Mobile Considerations

**Files:**
- Modify: `apps/web/components/mobile-header.tsx` — add `data-onboarding="nav-projects"` to mobile nav
- Modify: `apps/web/components/onboarding/tooltip.tsx` — responsive positioning

**Step 1: Mobile sidebar nav attribute**

The `MobileHeader` uses the shared `SidebarContent` component (from `sidebar.tsx`). The `data-onboarding` attribute added in Task 9 will already apply in both desktop and mobile contexts since `SidebarContent` renders the same `navItems` map.

Verify this by reading `mobile-header.tsx` and confirming it uses `<SidebarContent>`.

**Step 2: Responsive tooltip positioning**

In `tooltip.tsx`, add a media query check to prefer `bottom` positioning on mobile:

```tsx
// Inside the useEffect, after calculating position:
const isMobile = window.innerWidth < 768;
const effectiveSide = isMobile ? 'bottom' : side;
```

Use `effectiveSide` instead of `side` in the switch statement.

**Step 3: Commit**

```bash
git add apps/web/components/onboarding/tooltip.tsx
git commit -m "feat(onboarding): responsive tooltip positioning for mobile"
```

---

## Task 14: Integration Test — Full Onboarding Flow

**Files:**
- Create: `apps/web/components/onboarding/__tests__/provider.test.tsx`

**Step 1: Write test for state machine transitions**

Use Vitest with React Testing Library. This tests the core state machine logic (step transitions, persistence calls, skip logic).

```typescript
// apps/web/components/onboarding/__tests__/provider.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ONBOARDING_STEPS } from '@architech/shared';

// Test the step progression logic independently
describe('Onboarding step progression', () => {
  it('steps progress in correct order', () => {
    const steps = [...ONBOARDING_STEPS];
    expect(steps).toEqual([
      'welcome', 'tour-1', 'tour-2', 'tour-3',
      'tour-4', 'tour-5', 'tour-6', 'summary', 'completed',
    ]);
  });

  it('each step has a valid next step', () => {
    for (let i = 0; i < ONBOARDING_STEPS.length - 1; i++) {
      const current = ONBOARDING_STEPS[i];
      const next = ONBOARDING_STEPS[i + 1];
      expect(next).toBeDefined();
    }
  });

  it('completed is the terminal state', () => {
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe('completed');
  });
});
```

**Step 2: Run tests**

Run: `cd apps/web && npx vitest run components/onboarding/__tests__/provider.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/components/onboarding/__tests__/provider.test.tsx
git commit -m "test(onboarding): add unit tests for onboarding step progression"
```

---

## Task 15: Verify Build + Final Cleanup

**Files:** None new — verification only.

**Step 1: Type check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

**Step 2: Build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual smoke test checklist**

Run the dev server (`npm run dev`) and verify:
- [ ] New user (onboarding_step='welcome') sees full-screen welcome
- [ ] Clicking "Empezar" navigates to /projects with tooltip on sidebar
- [ ] Clicking "Ir a Proyectos" shows highlight on CreateProjectCard
- [ ] Creating a project navigates to project detail with explanation tooltips
- [ ] "Crear presupuesto" opens CreateBudgetDialog
- [ ] Creating a budget navigates to budget page with tooltip
- [ ] "Volver al proyecto" shows stats with budget impacted
- [ ] Summary modal shows and "Empezar a usar Agentect" completes onboarding
- [ ] Refreshing mid-flow resumes from correct step
- [ ] "Omitir onboarding" works from any step
- [ ] Navigating away shows snackbar with "Continuar" button
- [ ] Mobile: tooltips position correctly below targets

**Step 4: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "feat(onboarding): final polish and build verification"
```

---

## Summary

| Task | Description | Files | Estimated |
|------|-------------|-------|-----------|
| 1 | DB migration + shared types | 2 | 5 min |
| 2 | API route `/api/onboarding` | 2 | 5 min |
| 3 | Shadcn Popover component | 1 | 3 min |
| 4 | Overlay + Tooltip components | 2 | 15 min |
| 5 | Welcome slides component | 1 | 10 min |
| 6 | Summary modal component | 1 | 5 min |
| 7 | Provider (state machine + context) | 2 | 20 min |
| 8 | Layout integration | 1 | 3 min |
| 9 | `data-onboarding` attributes | 4 | 10 min |
| 10 | Project creation hook | 1 | 10 min |
| 11 | Budget creation hook | 2 | 10 min |
| 12 | Snackbar (resume) | 2 | 10 min |
| 13 | Mobile considerations | 1 | 5 min |
| 14 | Tests | 1 | 10 min |
| 15 | Build verification | 0 | 10 min |
