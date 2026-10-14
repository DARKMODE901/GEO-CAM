// src/context/GeoPhotosContext.tsx
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { GeoPhoto, Coords, PhotoSource, SyncStatus } from '@/types/geo';
import type { Album } from '@/db/schema';
import { useGeoPhotosDB, type PhotoFilter } from '@/hooks/useGeoPhotosDB';
import { useAlbumsDB } from '@/hooks/useAlbumsDB';
import { useAuth } from '@/context/AuthContext';

// ─── Tipos del contexto ───────────────────────────────────────────────────────

export interface AddPhotoParams {
  uri: string;
  coords: Coords | null;
  source: PhotoSource;
  albumId?: number | null;
  notes?: string | null;
}

interface GeoPhotosContextValue {
  photos: GeoPhoto[];
  albums: Album[];
  filter: PhotoFilter;
  setFilter: (f: PhotoFilter) => void;
  addPhoto: (params: AddPhotoParams) => Promise<void>;
  removePhoto: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
  updateNotes: (id: number, notes: string) => Promise<void>;
  toggleFavorite: (id: number, isFavorite: boolean) => Promise<void>;
  setAlbum: (id: number, albumId: number | null) => Promise<void>;
  createAlbum: (name: string, description?: string) => Promise<Album>;
  removeAlbum: (id: number) => Promise<void>;
  syncPhoto: (id: number) => Promise<void>;
  syncAllPhotos: (onProgress?: (current: number, total: number) => void) => Promise<{ synced: number; failed: number }>;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const GeoPhotosContext = createContext<GeoPhotosContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * GeoPhotosProvider: Conecta la capa de presentación (UI) con la capa de
 * datos persistente mediante SQLite, Drizzle ORM, FileSystem y Supabase Cloud Sync.
 *
 * Flujo de arquitectura:
 * Pantalla (UI) -> useGeoPhotos (Hook) -> Repositorios -> Drizzle/Esquema -> expo-sqlite
 *                                      -> Supabase Storage & PostgreSQL (Nube)
 */
export function GeoPhotosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;

  const {
    photos: rawPhotos,
    filter,
    setFilter,
    addPhoto: addPhotoDB,
    removePhoto,
    clearAll,
    updateNotes,
    toggleFavorite,
    setAlbum,
    syncPhoto,
    syncAllPhotos,
  } = useGeoPhotosDB(ownerId);

  const { albums, createAlbum, removeAlbum } = useAlbumsDB();

  // Mapear de entidad de SQLite (Drizzle) a modelo de interfaz GeoPhoto con syncStatus
  const photos: GeoPhoto[] = useMemo(() => {
    return rawPhotos.map((p) => {
      let syncStatus: SyncStatus = 'local_only';
      if (p.remotePath) {
        if (p.updatedAt > (p.syncedAt ?? 0)) {
          syncStatus = 'modified_pending';
        } else {
          syncStatus = 'synced';
        }
      }

      return {
        id: p.id,
        clientId: p.clientId,
        uri: p.uri,
        coords:
          p.latitude !== null && p.longitude !== null
            ? {
                latitude: p.latitude,
                longitude: p.longitude,
                accuracy: p.accuracy,
                altitude: p.altitude,
              }
            : null,
        source: p.source,
        albumId: p.albumId,
        notes: p.notes,
        isFavorite: Boolean(p.isFavorite),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        remotePath: p.remotePath,
        syncedAt: p.syncedAt,
        ownerId: p.ownerId,
        syncStatus,
      };
    });
  }, [rawPhotos]);

  const addPhoto = async (params: AddPhotoParams) => {
    await addPhotoDB(params);
  };

  const value: GeoPhotosContextValue = {
    photos,
    albums,
    filter,
    setFilter,
    addPhoto,
    removePhoto,
    clearAll,
    updateNotes,
    toggleFavorite,
    setAlbum,
    createAlbum,
    removeAlbum,
    syncPhoto,
    syncAllPhotos,
  };

  return (
    <GeoPhotosContext.Provider value={value}>
      {children}
    </GeoPhotosContext.Provider>
  );
}

// ─── Custom Hook de acceso ─────────────────────────────────────────────────────

/**
 * useGeoPhotos: hook de acceso seguro al contexto persistente.
 */
export function useGeoPhotos(): GeoPhotosContextValue {
  const ctx = useContext(GeoPhotosContext);
  if (!ctx) {
    throw new Error('useGeoPhotos debe usarse dentro de <GeoPhotosProvider>');
  }
  return ctx;
}
