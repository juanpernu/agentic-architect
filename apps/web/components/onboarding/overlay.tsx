'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTargetElement } from '@/lib/use-target-element';

interface OnboardingOverlayProps {
  targetSelector: string;
  className?: string;
}

export function OnboardingOverlay({ targetSelector, className }: OnboardingOverlayProps) {
  const maskId = useId();
  const [rect, setRect] = useState<DOMRect | null>(null);

  useTargetElement(targetSelector, (el) => {
    setRect(el.getBoundingClientRect());
  });

  if (!rect) return null;

  const padding = 8;

  return (
    <div
      className={cn('fixed inset-0 z-[9998] pointer-events-none', className)}
      aria-hidden="true"
    >
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id={maskId}>
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
          mask={`url(#${maskId})`}
        />
      </svg>
    </div>
  );
}
