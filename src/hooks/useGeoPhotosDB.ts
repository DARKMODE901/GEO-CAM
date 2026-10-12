// src/hooks/useGeoPhotosDB.ts
import { useCallback, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos, type Photo } from '@/db/schema';
import { photoRepository } from '@/repositories/photoRepository';
import { savePhotoPermanently } from '@/services/photoStorage';
import type { Coords, PhotoSource } from '@/types/geo';

export type PhotoFilter = 'all' | 'favorites' | number; // number represents albumId

/**
 * Hook reactivo para gestionar fotos geolocalizadas con Drizzle ORM y SQLite.
 * Capa 2 de la Arquitectura de 5 capas: Pantalla -> Hook -> Repositorio -> Drizzle -> SQLite
 */
export function useGeoPhotosDB() {
  const [filter, setFilter] = useState<PhotoFilter>('all');

  // Consulta reactiva con useLiveQuery
  const query =
    filter === 'all'
      ? db.select().from(photos).orderBy(desc(photos.createdAt))
      : filter === 'favorites'
      ? db.select().from(photos).where(eq(photos.isFavorite, 1)).orderBy(desc(photos.createdAt))
      : db.select().from(photos).where(eq(photos.albumId, filter)).orderBy(desc(photos.createdAt));

  const { data: rawPhotos, error: liveQueryError } = useLiveQuery(query, [filter]);
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

      // 2. Insertar metadatos en SQLite mediante el Repositorio (Capa 3)
      return photoRepository.create({
        uri: permanentUri,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        accuracy: coords?.accuracy ?? null,
        altitude: coords?.altitude ?? null,
        source,
        albumId: albumId ?? null,
        notes: notes ?? null,
        isFavorite: 0,
        createdAt: Date.now(),
      });
    },
    []
  );

  /**
   * Elimina una foto por su ID (base de datos + archivo físico).
   */
  const removePhoto = useCallback(async (id: number): Promise<void> => {
    await photoRepository.delete(id);
  }, []);

  /**
   * Elimina todas las fotos (base de datos + archivos físicos).
   */
  const clearAll = useCallback(async (): Promise<void> => {
    await photoRepository.deleteAll();
  }, []);

  /**
   * Actualiza las notas de una foto (Migración 2).
   */
  const updateNotes = useCallback(async (id: number, notes: string): Promise<void> => {
    await photoRepository.updateNotes(id, notes);
  }, []);

  /**
   * Alterna el estado de favorita de una foto (Migración 2).
   */
  const toggleFavorite = useCallback(async (id: number, current: boolean): Promise<void> => {
    await photoRepository.toggleFavorite(id, !current);
  }, []);

  /**
   * Asigna un álbum a una foto.
   */
  const setAlbum = useCallback(async (id: number, albumId: number | null): Promise<void> => {
    await photoRepository.setAlbum(id, albumId);
  }, []);

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
    error: liveQueryError,
  };
}

