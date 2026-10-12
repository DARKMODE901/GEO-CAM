// src/hooks/useAlbumsDB.ts
import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, type Album } from '@/db/schema';
import { albumRepository } from '@/repositories/albumRepository';

/**
 * Hook reactivo para gestionar álbumes con Drizzle ORM y SQLite.
 * Capa 2 de la Arquitectura de 5 capas.
 */
export function useAlbumsDB() {
  const { data: rawAlbums, error: liveQueryError } = useLiveQuery(
    db.select().from(albums).orderBy(desc(albums.createdAt))
  );

  const albumList: Album[] = rawAlbums ?? [];

  const createAlbum = useCallback(async (name: string, description?: string): Promise<Album> => {
    return albumRepository.create(name, description);
  }, []);

  const removeAlbum = useCallback(async (id: number): Promise<void> => {
    await albumRepository.delete(id);
  }, []);

  return {
    albums: albumList,
    createAlbum,
    removeAlbum,
    error: liveQueryError,
  };
}

