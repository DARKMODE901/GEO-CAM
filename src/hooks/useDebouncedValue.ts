// src/hooks/useDebouncedValue.ts
import { useEffect, useState } from 'react';

/**
 * Retrasa la propagación de un valor hasta que transcurra el delay indicado sin cambios.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
