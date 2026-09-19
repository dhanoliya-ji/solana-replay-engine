import { useCallback, useRef, useSyncExternalStore, type SetStateAction } from 'react';

const LOCAL_STORAGE_CHANGE_EVENT = 'copy-sim-local-storage-change';

function readStoredValue<T>(key: string, initialValue: T) {
  if (typeof window === 'undefined') return initialValue;
  try {
    const raw = window.localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const cacheRef = useRef<{ raw: string | null; value: T } | null>(null);
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined') {
        return () => undefined;
      }

      const handleStorage = (event: StorageEvent) => {
        if (event.key == null || event.key === key) {
          onStoreChange();
        }
      };

      const handleLocalChange = (event: Event) => {
        const changedKey = (event as CustomEvent<string>).detail;
        if (!changedKey || changedKey === key) {
          onStoreChange();
        }
      };

      window.addEventListener('storage', handleStorage);
      window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleLocalChange);

      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleLocalChange);
      };
    },
    [key]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return initialValue;

    const raw = window.localStorage.getItem(key);
    if (cacheRef.current && cacheRef.current.raw === raw) {
      return cacheRef.current.value;
    }

    const value = readStoredValue(key, initialValue);
    cacheRef.current = { raw, value };
    return value;
  }, [initialValue, key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, () => initialValue);

  const setValue = useCallback(
    (nextValue: SetStateAction<T>) => {
      if (typeof window === 'undefined') return;

      const resolvedValue =
        typeof nextValue === 'function'
          ? (nextValue as (currentValue: T) => T)(readStoredValue(key, initialValue))
          : nextValue;

      const raw = JSON.stringify(resolvedValue);
      cacheRef.current = { raw, value: resolvedValue };
      window.localStorage.setItem(key, raw);
      window.dispatchEvent(
        new CustomEvent<string>(LOCAL_STORAGE_CHANGE_EVENT, { detail: key })
      );
    },
    [initialValue, key]
  );

  return [value, setValue, true] as const;
}
