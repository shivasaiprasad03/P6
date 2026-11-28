import { useEffect, useState } from 'react';

/**
 * Returns `value` once it has stopped changing for `delayMs`. Used for screen-reader
 * announcements, so dragging a slider is announced once instead of on every step.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
