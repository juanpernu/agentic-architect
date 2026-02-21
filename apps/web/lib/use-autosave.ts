import { useRef, useEffect, useState, useCallback } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 2000;
const SAVED_DISPLAY_MS = 3000;

export function useAutosave(
  budgetId: string,
  snapshot: unknown,
  enabled: boolean
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSnapshotRef = useRef<string>('');
  const isMountedRef = useRef(true);
  const latestSnapshotRef = useRef<unknown>(snapshot);
  const hasPendingChangesRef = useRef(false);
  const budgetIdRef = useRef(budgetId);

  // Keep refs in sync
  latestSnapshotRef.current = snapshot;
  budgetIdRef.current = budgetId;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const saveToServer = useCallback(async (data: unknown): Promise<boolean> => {
    try {
      const res = await fetch(`/api/budgets/${budgetIdRef.current}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: data }),
      });

      if (!res.ok) return false;

      hasPendingChangesRef.current = false;
      return true;
    } catch {
      return false;
    }
  }, []);

  const save = useCallback(async (data: unknown) => {
    if (isMountedRef.current) setSaveStatus('saving');

    const ok = await saveToServer(data);

    if (!isMountedRef.current) return;

    if (!ok) {
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saved');
    savedTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setSaveStatus('idle');
    }, SAVED_DISPLAY_MS);
  }, [saveToServer]);

  // Debounced autosave effect
  useEffect(() => {
    if (!enabled) return;

    const serialized = JSON.stringify(snapshot);

    if (serialized === prevSnapshotRef.current) return;

    // Skip initial render (store baseline without saving)
    if (prevSnapshotRef.current === '') {
      prevSnapshotRef.current = serialized;
      return;
    }

    prevSnapshotRef.current = serialized;
    hasPendingChangesRef.current = true;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    timerRef.current = setTimeout(() => {
      save(snapshot);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [snapshot, enabled, save]);

  // Flush pending changes on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (hasPendingChangesRef.current) {
        // Fire-and-forget save with latest data
        const data = latestSnapshotRef.current;
        fetch(`/api/budgets/${budgetIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot: data }),
          keepalive: true, // ensures request completes even after page unload
        }).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Immediately save the current snapshot (bypass debounce).
   * Returns true if save succeeded.
   */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return saveToServer(latestSnapshotRef.current);
  }, [saveToServer]);

  const retry = useCallback(() => {
    save(latestSnapshotRef.current);
  }, [save]);

  return { saveStatus, retry, flush };
}
