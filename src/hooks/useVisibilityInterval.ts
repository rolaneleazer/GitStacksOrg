import { useEffect, useRef } from 'react';

/**
 * Runs a periodic callback only while the browser tab is visible.
 * Immediately pauses when the user switches tabs or minimizes the window,
 * preventing unnecessary Supabase queries and egress from idle background tabs.
 */
export function useVisibilityInterval(
  callback: () => void,
  intervalMs: number | null,
  options?: { refreshOnReturnIfStaleMs?: number }
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const lastTickAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (intervalMs === null || intervalMs <= 0) return;

    let timerId: number | null = null;

    const clearTimer = () => {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };

    const startTimer = () => {
      clearTimer();
      if (typeof document !== 'undefined' && document.hidden) return;
      timerId = window.setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        lastTickAtRef.current = Date.now();
        callbackRef.current();
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        clearTimer();
      } else {
        const staleThreshold = options?.refreshOnReturnIfStaleMs ?? intervalMs;
        if (Date.now() - lastTickAtRef.current >= staleThreshold) {
          lastTickAtRef.current = Date.now();
          callbackRef.current();
        }
        startTimer();
      }
    };

    startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, options?.refreshOnReturnIfStaleMs]);
}
