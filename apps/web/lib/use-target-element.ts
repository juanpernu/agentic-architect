'use client';

import { useEffect, useRef } from 'react';

const OBSERVER_TIMEOUT_MS = 10_000;

/**
 * Waits for a DOM element matching `selector` to appear (using MutationObserver if needed),
 * then tracks it with ResizeObserver and scroll/resize listeners.
 * Calls `onUpdate(el)` whenever the element's geometry might have changed.
 * Auto-disconnects the MutationObserver after 10s if the element never appears.
 */
export function useTargetElement(
  selector: string,
  onUpdate: (el: Element) => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let updateFn: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const setup = (el: Element) => {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      updateFn = () => onUpdateRef.current(el);
      requestAnimationFrame(updateFn);

      resizeObserver = new ResizeObserver(updateFn);
      resizeObserver.observe(el);
      window.addEventListener('scroll', updateFn, true);
      window.addEventListener('resize', updateFn);
    };

    const el = document.querySelector(selector);
    if (el) {
      setup(el);
    } else {
      mutationObserver = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          mutationObserver?.disconnect();
          mutationObserver = null;
          setup(found);
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
      timeoutId = setTimeout(() => {
        mutationObserver?.disconnect();
        mutationObserver = null;
      }, OBSERVER_TIMEOUT_MS);
    }

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      if (updateFn) {
        window.removeEventListener('scroll', updateFn, true);
        window.removeEventListener('resize', updateFn);
      }
    };
  }, [selector]);
}
