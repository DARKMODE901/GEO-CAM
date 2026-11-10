// src/hooks/useGeoPhotosDB.ts
import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { desc, eq, and, or, isNull, type SQL } from 'drizzle-orm';
import { useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { photos, type Photo } from '@/db/schema';
import { photoRepository } from '@/repositories/photoRepository';
import { savePhotoPermanently } from '@/services/photoStorage';
import {
  runSyncCycle,
  syncSinglePhotoWithPullFirst,
} from '@/services/syncService';
import type { Coords, PhotoSource } from '@/types/geo';

export type PhotoFilter = 'all' | 'favorites' | number; // number represents albumId

/**
 * Hook reactivo para gestionar fotos geolocalizadas con Drizzle ORM y SQLite.
 * Principio Offline-First: SQLite es la fuente de verdad absoluta; toda mutación
 * escribe en local de forma inmediata e invalida ['sync'] para sincronizar en segundo plano.
 */
export function useGeoPhotosDB(ownerId?: string | null) {
  const [filter, setFilter] = useState<PhotoFilter>('all');
  const queryClient = useQueryClient();

  // Asegurar campos de sincronización en fotos existentes al inicio
  useEffect(() => {
    photoRepository.ensureSyncFields().catch((err) => {
      console.warn('[useGeoPhotosDB] Error asegurando campos sync:', err);
    });
  }, []);

  // Construcción del WHERE excluyendo siempre borrados lógicos (deletedAt IS NULL)
  const conditions: SQL[] = [isNull(photos.deletedAt)];

  if (ownerId) {
    const userCond = or(eq(photos.ownerId, ownerId), isNull(photos.ownerId));
    if (userCond) conditions.push(userCond);
  }

  if (filter === 'favorites') {
    conditions.push(eq(photos.isFavorite, 1));
  } else if (typeof filter === 'number') {
    conditions.push(eq(photos.albumId, filter));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  // Consulta reactiva con useLiveQuery
  const query = db
    .select()
    .from(photos)
    .where(whereClause)
    .orderBy(desc(photos.createdAt));

  const { data: rawPhotos, error: liveQueryError } = useLiveQuery(query, [
    filter,
    ownerId,
  ]);
  const photoList: Photo[] = rawPhotos ?? [];

  /**
   * Dispara la invalidación de sincronización en segundo plano sin bloquear la UI.
   */
  const triggerBackgroundSync = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['sync'] });
  }, [queryClient]);

  /**
   * Guarda una foto física permanentemente en FileSystem.documentDirectory
   * y guarda sus metadatos en SQLite mediante photoRepository.
   */
  const addPhoto = useCallback(
    async ({
      uri: tempUri,
      coords,
      source,
      albumId = null,
      notes = null,
    }: {
      uri: string;
      coords: Coords | null;
      source: PhotoSource;
      albumId?: number | null;
      notes?: string | null;
    }): Promise<Photo> => {
      const permanentUri = await savePhotoPermanently(tempUri);
      const clientId = Crypto.randomUUID();
      const now = Date.now();

      const created = await photoRepository.create({
        clientId,
        uri: permanentUri,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        accuracy: coords?.accuracy ?? null,
        altitude: coords?.altitude ?? null,
        source,
        albumId: albumId ?? null,
        notes: notes ?? null,
        isFavorite: 0,
        createdAt: now,
        updatedAt: now,
        remotePath: null,
        syncedAt: null,
        ownerId: ownerId ?? null,
        deletedAt: null,
      });

      triggerBackgroundSync();
      return created;
    },
    [ownerId, triggerBackgroundSync]
  );

  /**
   * Marca borrado lógico en SQLite e invalida ['sync'] para propagar el borrado a Supabase.
   */
  const removePhoto = useCallback(
    async (id: number): Promise<void> => {
      await photoRepository.delete(id);
      triggerBackgroundSync();
    },
    [triggerBackgroundSync]
  );

  /**
   * Marca borrado lógico masivo de todas las fotos activas e invalida ['sync'].
   */
  const clearAll = useCallback(async (): Promise<void> => {
    await photoRepository.deleteAll(ownerId);
    triggerBackgroundSync();
  }, [ownerId, triggerBackgroundSync]);

  /**
   * Actualiza las notas de una foto en SQLite, actualiza updatedAt e invalida ['sync'].
   */
  const updateNotes = useCallback(
    async (id: number, notes: string): Promise<void> => {
      await photoRepository.updateNotes(id, notes);
      triggerBackgroundSync();
    },
    [triggerBackgroundSync]
  );

  /**
   * Alterna favorita en SQLite, actualiza updatedAt e invalida ['sync'].
   */
  const toggleFavorite = useCallback(
    async (id: number, current: boolean): Promise<void> => {
      await photoRepository.toggleFavorite(id, !current);
      triggerBackgroundSync();
    },
    [triggerBackgroundSync]
  );

  /**
   * Asigna o cambia el álbum en SQLite, actualiza updatedAt e invalida ['sync'].
   */
  const setAlbum = useCallback(
    async (id: number, albumId: number | null): Promise<void> => {
      await photoRepository.setAlbum(id, albumId);
      triggerBackgroundSync();
    },
    [triggerBackgroundSync]
  );

  /**
   * Sincroniza manualmente una foto respetando Pull -> Push estricto.
   */
  const syncPhoto = useCallback(
    async (id: number): Promise<void> => {
      if (!ownerId) {
        throw new Error('Debes iniciar sesión para sincronizar fotos con la nube.');
      }

      const net = await Network.getNetworkStateAsync();
      const online = Boolean(net.isConnected && net.isInternetReachable !== false);
      if (!online) {
        throw new Error(
          'Sin conexión a internet. La foto permanece segura en SQLite y se subirá automáticamente al reconectar.'
        );
      }

      await syncSinglePhotoWithPullFirst(id, ownerId);
      await queryClient.invalidateQueries({ queryKey: ['posts-feed'] });
      await queryClient.invalidateQueries({ queryKey: ['sync'], refetchType: 'none' });
    },
    [ownerId, queryClient]
  );

  /**
   * Ejecuta un ciclo completo Pull -> Push manual con progreso para la UI.
   */
  const syncAllPhotos = useCallback(
    async (
      onProgress?: (current: number, total: number) => void
    ): Promise<{ synced: number; failed: number; pulled: number }> => {
      if (!ownerId) {
        throw new Error('Debes iniciar sesión para sincronizar fotos con la nube.');
      }

      const net = await Network.getNetworkStateAsync();
      const online = Boolean(net.isConnected && net.isInternetReachable !== false);
      if (!online) {
        throw new Error(
          'Sin conexión a internet. Los cambios están guardados en SQLite y se sincronizarán al reconectar.'
        );
      }

      const result = await runSyncCycle(ownerId, (progress) => {
        if (progress.phase === 'push') {
          onProgress?.(progress.current, progress.total);
        }
      });

      queryClient.setQueryData(['sync', ownerId], result);
      if (result.pulled > 0 || result.pushed > 0) {
        await queryClient.invalidateQueries({ queryKey: ['posts-feed'] });
      }

      return {
        synced: result.pushed,
        failed: result.failed,
        pulled: result.pulled,
      };
    },
    [ownerId, queryClient]
  );

  return {
    photos: photoList,
    totalPhotos: photoList.length,
    filter,
    setFilter,
    addPhoto,
    removePhoto,
    clearAll,
    updateNotes,
    toggleFavorite,
    setAlbum,
    syncPhoto,
    syncAllPhotos,
    error: liveQueryError,
  };
}
