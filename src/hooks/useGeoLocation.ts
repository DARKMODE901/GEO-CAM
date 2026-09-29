// src/hooks/useGeoLocation.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import type { Coords, PermissionState } from '@/types/geo';

interface UseGeoLocationOptions {
  /** Si true, inicia un watcher en tiempo real de la posición */
  watch?: boolean;
}

interface UseGeoLocationReturn {
  permission: PermissionState;
  coords: Coords | null;
  requestPermission: () => Promise<void>;
  openSettings: () => Promise<void>;
  getCurrent: () => Promise<Coords | null>;
}

export function useGeoLocation({
  watch = false,
}: UseGeoLocationOptions = {}): UseGeoLocationReturn {
  // Regla Top-Level: todos los hooks en el nivel superior
  const [permission, setPermission] = useState<PermissionState>('checking');
  const [coords, setCoords] = useState<Coords | null>(null);

  // useRef: guarda el subscription del watcher sin causar re-renders adicionales
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  // ── Verificar permiso al montar ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;

      if (status === 'granted') {
        setPermission('granted');
      } else if (canAskAgain) {
        setPermission('denied');
      } else {
        setPermission('blocked');
      }
    })();

    // Cleanup: evita actualizar estado en componente desmontado
    return () => { cancelled = true; };
  }, []);

  // ── Watcher de posición en tiempo real ───────────────────────────────────
  // useEffect con cleanup: limpia la suscripción al desmontar (previene fugas)
  useEffect(() => {
    if (permission !== 'granted' || !watch) return;

    let active = true;

    (async () => {
      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5_000,
          distanceInterval: 10,
        },
        (loc) => {
          if (!active) return;
          setCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
            altitude: loc.coords.altitude,
          });
        }
      );
    })();

    // Cleanup: elimina el watcher al desmontar o cuando cambia el permiso
    return () => {
      active = false;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, [permission, watch]);

  const requestPermission = useCallback(async () => {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermission('granted');
    } else if (canAskAgain) {
      setPermission('denied');
    } else {
      setPermission('blocked');
    }
  }, []);

  const openSettings = useCallback(async () => {
    await Linking.openSettings();
  }, []);

  const getCurrent = useCallback(async (): Promise<Coords | null> => {
    if (permission !== 'granted') return null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const c: Coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        altitude: loc.coords.altitude,
      };
      setCoords(c);
      return c;
    } catch {
      return null;
    }
  }, [permission]);

  return { permission, coords, requestPermission, openSettings, getCurrent };
}
