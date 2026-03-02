'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Reads `?create=true` from the URL, calls `onTrigger`, and
 * removes the param while preserving any other query params.
 */
export function useCreateParam(onTrigger: () => void) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      onTrigger();
      const next = new URLSearchParams(searchParams.toString());
      next.delete('create');
      const qs = next.toString();
      window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
    }
  }, [searchParams, pathname, onTrigger]);
}
