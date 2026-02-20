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

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const save = useCallback(async (data: unknown) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/budgets/${budgetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: data }),
      });

      if (!isMountedRef.current) return;

      if (!res.ok) {
        setSaveStatus('error');
        return;
      }

      setSaveStatus('saved');
      savedTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setSaveStatus('idle');
      }, SAVED_DISPLAY_MS);
    } catch {
      if (isMountedRef.current) setSaveStatus('error');
    }
  }, [budgetId]);

  useEffect(() => {
    if (!enabled) return;

    const serialized = JSON.stringify(snapshot);

    if (serialized === prevSnapshotRef.current) return;

    if (prevSnapshotRef.current === '') {
      prevSnapshotRef.current = serialized;
      return;
    }

    prevSnapshotRef.current = serialized;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    timerRef.current = setTimeout(() => {
      save(snapshot);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [snapshot, enabled, save]);

  const retry = useCallback(() => {
    save(snapshot);
  }, [save, snapshot]);

  return { saveStatus, retry };
}
