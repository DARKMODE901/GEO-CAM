// src/hooks/useGeoPhotosDB.ts
import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { desc, eq, and, or, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos, type Photo } from '@/db/schema';
import { photoRepository } from '@/repositories/photoRepository';
import { savePhotoPermanently } from '@/services/photoStorage';
import { uploadPhoto, upsertPhotoMetadata } from '@/services/cloudPhotos';
import type { Coords, PhotoSource } from '@/types/geo';
import * as Crypto from 'expo-crypto';

export type PhotoFilter = 'all' | 'favorites' | number; // number represents albumId

/**
 * Hook reactivo para gestionar fotos geolocalizadas con Drizzle ORM y SQLite.
 * Capa 2 de la Arquitectura de 5 capas: Pantalla -> Hook -> Repositorio -> Drizzle -> SQLite
 */
export function useGeoPhotosDB(ownerId?: string | null) {
  const [filter, setFilter] = useState<PhotoFilter>('all');

  // Asegurar campos de sincronización en fotos existentes al inicio
  useEffect(() => {
    photoRepository.ensureSyncFields().catch((err) => {
      console.warn('[useGeoPhotosDB] Error asegurando campos sync:', err);
    });
  }, []);

  // Construcción del where con soporte multi-usuario (C5)
  const userCondition = ownerId
    ? or(eq(photos.ownerId, ownerId), isNull(photos.ownerId))
    : undefined;

  let whereClause;
  if (filter === 'all') {
    whereClause = userCondition;
  } else if (filter === 'favorites') {
    whereClause = userCondition
      ? and(eq(photos.isFavorite, 1), userCondition)
      : eq(photos.isFavorite, 1);
  } else {
    whereClause = userCondition
      ? and(eq(photos.albumId, filter), userCondition)
      : eq(photos.albumId, filter);
  }

  // Consulta reactiva con useLiveQuery
  const query = whereClause
    ? db.select().from(photos).where(whereClause).orderBy(desc(photos.createdAt))
    : db.select().from(photos).orderBy(desc(photos.createdAt));

  const { data: rawPhotos, error: liveQueryError } = useLiveQuery(query, [filter, ownerId]);
  const photoList: Photo[] = rawPhotos ?? [];

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
      // 1. Guardar permanentemente la imagen física (expo-file-system)
      const permanentUri = await savePhotoPermanently(tempUri);
      const clientId = Crypto.randomUUID();
      const now = Date.now();

      // 2. Insertar metadatos en SQLite mediante el Repositorio (Capa 3)
      return photoRepository.create({
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
      });
    },
    [ownerId]
  );

  /**
   * Elimina una foto por su ID (base de datos + archivo físico + nube si existe).
   */
  const removePhoto = useCallback(async (id: number): Promise<void> => {
    await photoRepository.delete(id, true);
  }, []);

  /**
   * Elimina todas las fotos (base de datos + archivos físicos).
   */
  const clearAll = useCallback(async (): Promise<void> => {
    await photoRepository.deleteAll();
  }, []);

  /**
   * Actualiza las notas de una foto (Migración 2) y updatedAt.
   */
  const updateNotes = useCallback(async (id: number, notes: string): Promise<void> => {
    await photoRepository.updateNotes(id, notes);
  }, []);

  /**
   * Alterna el estado de favorita de una foto y updatedAt.
   */
  const toggleFavorite = useCallback(async (id: number, current: boolean): Promise<void> => {
    await photoRepository.toggleFavorite(id, !current);
  }, []);

  /**
   * Asigna un álbum a una foto y actualiza updatedAt.
   */
  const setAlbum = useCallback(async (id: number, albumId: number | null): Promise<void> => {
    await photoRepository.setAlbum(id, albumId);
  }, []);

  /**
   * Sube una foto a Supabase Storage y actualiza los metadatos en PostgreSQL (T5).
   */
  const syncPhoto = useCallback(
    async (id: number): Promise<void> => {
      if (!ownerId) {
        throw new Error('Debes iniciar sesión para sincronizar fotos con la nube.');
      }
      const p = await photoRepository.getById(id);
      if (!p) throw new Error('Foto no encontrada');

      // 1. Subir archivo a Supabase Storage (ArrayBuffer, REGLA 6)
      const storagePath = await uploadPhoto(ownerId, p.clientId, p.uri);

      // 2. Upsert de metadatos en PostgreSQL
      await upsertPhotoMetadata({
        userId: ownerId,
        clientId: p.clientId,
        storagePath,
        latitude: p.latitude,
        longitude: p.longitude,
        note: p.notes,
        favorite: Boolean(p.isFavorite),
        source: p.source,
        takenAt: new Date(p.createdAt).toISOString(),
        updatedAt: new Date(p.updatedAt || p.createdAt).toISOString(),
      });

      // 3. Marcar como sincronizada en SQLite local
      const now = Date.now();
      await photoRepository.markSynced(p.id, storagePath, now, ownerId);
    },
    [ownerId]
  );

  /**
   * Sincronización masiva de todas las fotos pendientes con progreso (C2).
   */
  const syncAllPhotos = useCallback(
    async (onProgress?: (current: number, total: number) => void): Promise<{ synced: number; failed: number }> => {
      if (!ownerId) {
        throw new Error('Debes iniciar sesión para sincronizar fotos con la nube.');
      }

      // Fotos que necesitan sincronización: nunca subidas o modificadas después de la última sincronización
      const allPhotos = await photoRepository.getAll(ownerId);
      const pendingPhotos = allPhotos.filter(
        (p) => !p.remotePath || p.updatedAt > (p.syncedAt ?? 0)
      );

      const total = pendingPhotos.length;
      let synced = 0;
      let failed = 0;

      if (total === 0) {
        onProgress?.(0, 0);
        return { synced: 0, failed: 0 };
      }

      for (let i = 0; i < total; i++) {
        const photo = pendingPhotos[i];
        onProgress?.(i + 1, total);
        try {
          // 1. Subir a storage
          const storagePath = await uploadPhoto(ownerId, photo.clientId, photo.uri);

          // 2. Upsert metadatos
          await upsertPhotoMetadata({
            userId: ownerId,
            clientId: photo.clientId,
            storagePath,
            latitude: photo.latitude,
            longitude: photo.longitude,
            note: photo.notes,
            favorite: Boolean(photo.isFavorite),
            source: photo.source,
            takenAt: new Date(photo.createdAt).toISOString(),
            updatedAt: new Date(photo.updatedAt || photo.createdAt).toISOString(),
          });

          // 3. Marcar en SQLite local
          await photoRepository.markSynced(photo.id, storagePath, Date.now(), ownerId);
          synced++;
        } catch (err) {
          console.error(`[syncAllPhotos] Error sincronizando foto ${photo.id}:`, err);
          failed++;
        }
      }

      return { synced, failed };
    },
    [ownerId]
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
