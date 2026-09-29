// src/hooks/useShake.ts
import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

const SHAKE_THRESHOLD = 1.8;    // fuerza mínima en G
const SHAKE_COOLDOWN_MS = 1500; // ms entre detecciones para evitar doble disparo

/**
 * useShake — detecta un gesto de agitar el teléfono y ejecuta un callback.
 *
 * Reglas aplicadas:
 *  - useEffect con cleanup: remueve la suscripción al Accelerometer al desmontar
 *  - useRef para lastShakeRef: persiste el timestamp sin gatillar re-renders
 *  - useRef para callbackRef: evita stale closure — siempre usa la última versión del callback
 */
export function useShake(onShake: () => void): void {
  // Guarda siempre la última versión del callback para evitar stale closures
  const callbackRef = useRef(onShake);
  callbackRef.current = onShake;

  // Persiste el timestamp de la última detección sin causar re-renders
  const lastShakeRef = useRef<number>(0);

  useEffect(() => {
    // Frecuencia de muestreo: 100ms
    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const totalForce = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (
        totalForce > SHAKE_THRESHOLD &&
        now - lastShakeRef.current > SHAKE_COOLDOWN_MS
      ) {
        lastShakeRef.current = now;
        callbackRef.current();
      }
    });

    // Cleanup: elimina la suscripción al desmontar para prevenir fugas de memoria
    return () => {
      subscription.remove();
    };
  }, []); // Sin dependencias: el efecto se registra solo una vez
}
