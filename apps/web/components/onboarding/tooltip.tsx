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
  currentStep,
  totalSteps,
}: OnboardingTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let updateFn: (() => void) | null = null;

    const setup = (target: Element) => {
      updateFn = () => {
        if (!tooltipRef.current) return;
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const gap = 12;

        const isMobile = window.innerWidth < 768;
        const effectiveSide = isMobile ? 'bottom' : side;

        let top = 0;
        let left = 0;

        switch (effectiveSide) {
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

      requestAnimationFrame(updateFn);

      resizeObserver = new ResizeObserver(updateFn);
      resizeObserver.observe(target);

      window.addEventListener('resize', updateFn);
      window.addEventListener('scroll', updateFn, true);
    };

    const target = document.querySelector(targetSelector);
    if (target) {
      setup(target);
    } else {
      // Element not yet in DOM (e.g. page still loading data) — wait for it
      mutationObserver = new MutationObserver(() => {
        const el = document.querySelector(targetSelector);
        if (el) {
          mutationObserver?.disconnect();
          mutationObserver = null;
          setup(el);
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (updateFn) {
        window.removeEventListener('resize', updateFn);
        window.removeEventListener('scroll', updateFn, true);
      }
    };
  }, [targetSelector, side]);

  return (
    <div
      ref={tooltipRef}
      role="dialog"
      aria-modal="false"
      aria-label={title || 'Onboarding'}
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
