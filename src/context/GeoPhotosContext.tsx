// src/context/GeoPhotosContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { GeoPhoto } from '@/types/geo';

// ─── Tipos del contexto ───────────────────────────────────────────────────────

interface GeoPhotosContextValue {
  photos: GeoPhoto[];
  addPhoto: (photo: GeoPhoto) => void;
  removePhoto: (id: string) => void;
  clearAll: () => void;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const GeoPhotosContext = createContext<GeoPhotosContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * GeoPhotosProvider: provee el estado global de fotos geolocalizadas.
 *
 * Reglas aplicadas:
 *  - useState en Top-Level
 *  - Inmutabilidad estricta: nunca se muta el array directamente
 *    addPhoto:    [...prev, photo]           → nueva referencia
 *    removePhoto: prev.filter(...)           → nueva referencia
 *    clearAll:    []                         → nueva referencia vacía
 */
export function GeoPhotosProvider({ children }: { children: ReactNode }) {
  // Las fotos más recientes aparecen primero (addPhoto prepend con spread)
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);

  const addPhoto = useCallback((photo: GeoPhoto) => {
    // Inmutabilidad: spread crea nueva referencia — la foto nueva va al frente
    setPhotos((prev) => [photo, ...prev]);
  }, []);

  const removePhoto = useCallback((id: string) => {
    // Inmutabilidad: filter devuelve un nuevo array
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setPhotos([]);
  }, []);

  return (
    <GeoPhotosContext.Provider value={{ photos, addPhoto, removePhoto, clearAll }}>
      {children}
    </GeoPhotosContext.Provider>
  );
}

// ─── Custom Hook de acceso ─────────────────────────────────────────────────────

/**
 * useGeoPhotos: hook de acceso seguro al contexto.
 * Lanza error descriptivo si se usa fuera del Provider.
 */
export function useGeoPhotos(): GeoPhotosContextValue {
  const ctx = useContext(GeoPhotosContext);
  if (!ctx) {
    throw new Error('useGeoPhotos debe usarse dentro de <GeoPhotosProvider>');
  }
  return ctx;
}
