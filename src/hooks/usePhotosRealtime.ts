// src/hooks/usePhotosRealtime.ts
// Suscripción en tiempo real a public.photos con limpieza estricta del canal.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToPhotosRealtime } from '@/services/cloudPhotos';

export function usePhotosRealtime(userId: string | null | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToPhotosRealtime((eventType) => {
      console.log('[Realtime] Cambio detectado en public.photos:', eventType);
      void queryClient.invalidateQueries({ queryKey: ['posts-feed'] });
      void queryClient.invalidateQueries({ queryKey: ['sync'] });
    });

    return () => {
      unsubscribe();
    };
  }, [userId, queryClient]);
}
