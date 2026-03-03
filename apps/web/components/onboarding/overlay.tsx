'use client';

import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

interface OnboardingOverlayProps {
  targetSelector: string;
  className?: string;
}

export function OnboardingOverlay({ targetSelector, className }: OnboardingOverlayProps) {
  const maskId = useId();
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let updateFn: (() => void) | null = null;

    const setup = (el: Element) => {
      updateFn = () => setRect(el.getBoundingClientRect());
      updateFn();

      resizeObserver = new ResizeObserver(updateFn);
      resizeObserver.observe(el);
      window.addEventListener('scroll', updateFn, true);
      window.addEventListener('resize', updateFn);
    };

    const el = document.querySelector(targetSelector);
    if (el) {
      setup(el);
    } else {
      // Element not yet in DOM (e.g. page still loading data) — wait for it
      mutationObserver = new MutationObserver(() => {
        const found = document.querySelector(targetSelector);
        if (found) {
          mutationObserver?.disconnect();
          mutationObserver = null;
          setup(found);
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (updateFn) {
        window.removeEventListener('scroll', updateFn, true);
        window.removeEventListener('resize', updateFn);
      }
    };
  }, [targetSelector]);

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
