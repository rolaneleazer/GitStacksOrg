import { useEffect, useState } from 'react';

/**
 * Custom hook to debounce rapid state changes (e.g. search inputs or filter triggers)
 * by at least 400ms before querying backend or Supabase database.
 */
export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
