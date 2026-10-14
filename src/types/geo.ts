// src/types/geo.ts
// Tipos compartidos para toda la app GeoCam

export type PermissionState = 'checking' | 'granted' | 'denied' | 'blocked';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
}

export type PhotoSource = 'camera' | 'gallery';

export type SyncStatus = 'local_only' | 'synced' | 'modified_pending';

export interface GeoPhoto {
  id: number;
  clientId: string;
  uri: string;
  coords: Coords | null;
  source: PhotoSource;
  albumId?: number | null;
  notes?: string | null;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  remotePath?: string | null;
  syncedAt?: number | null;
  ownerId?: string | null;
  syncStatus: SyncStatus;
}
