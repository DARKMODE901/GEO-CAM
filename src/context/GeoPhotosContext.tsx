// src/context/GeoPhotosContext.tsx
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { GeoPhoto, Coords, PhotoSource, SyncStatus } from '@/types/geo';
import type { Album } from '@/db/schema';
import { useGeoPhotosDB, type PhotoFilter } from '@/hooks/useGeoPhotosDB';
import { useAlbumsDB } from '@/hooks/useAlbumsDB';
import { useAuth } from '@/context/AuthContext';
import { useSync, type SyncMonitorState } from '@/hooks/useSync';
import type { SyncCycleResult } from '@/services/syncService';

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
  syncAllPhotos: (
    onProgress?: (current: number, total: number) => void
  ) => Promise<{ synced: number; failed: number; pulled: number }>;
  monitorState: SyncMonitorState;
  forceSync: () => Promise<SyncCycleResult | null>;
  clearSyncErrors: () => Promise<void>;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const GeoPhotosContext = createContext<GeoPhotosContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * GeoPhotosProvider: Conecta la capa de presentación (UI) con SQLite (fuente de verdad)
 * y orquesta en segundo plano la sincronización bidireccional Pull -> Push con TanStack Query v5.
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

  // Mantiene activo el motor de sincronización automática (reconexión, primer plano e invalidación)
  const { monitorState, forceSync, clearSyncErrors } = useSync(ownerId);

  // Mapear entidad SQLite (Drizzle) -> modelo de interfaz GeoPhoto con estado de sincronización
  const photos: GeoPhoto[] = useMemo(() => {
    return rawPhotos.map((p) => {
      let syncStatus: SyncStatus = 'synced';
      if (p.syncedAt === null) {
        syncStatus = 'local_only';
      } else if (p.syncedAt < p.updatedAt) {
        syncStatus = 'modified_pending';
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
        deletedAt: p.deletedAt,
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
    monitorState,
    forceSync,
    clearSyncErrors,
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
