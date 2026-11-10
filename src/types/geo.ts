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
  deletedAt?: number | null;
  syncStatus: SyncStatus;
}

export interface GeoAlbum {
  id: number;
  name: string;
  description: string | null;
  createdAt: number;
}

export interface RemotePhoto {
  id: number;
  user_id: string;
  client_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: PhotoSource;
  taken_at: string;
  updated_at: string;
  created_at: string;
  server_updated_at: string;
  deleted_at: string | null;
}

export interface RemotePhotoFeedItem extends RemotePhoto {
  signedUrl?: string;
}

export interface RemoteFeedPage {
  items: RemotePhotoFeedItem[];
  nextCursor: string | null;
}
