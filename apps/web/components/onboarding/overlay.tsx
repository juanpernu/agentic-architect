'use client';

import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

interface OnboardingOverlayProps {
  targetSelector: string;
  onClick?: () => void;
  className?: string;
}

export function OnboardingOverlay({ targetSelector, onClick, className }: OnboardingOverlayProps) {
  const maskId = useId();
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
