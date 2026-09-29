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

export interface GeoPhoto {
  id: string;
  uri: string;
  coords: Coords | null;
  source: PhotoSource;
  createdAt: number;
}
