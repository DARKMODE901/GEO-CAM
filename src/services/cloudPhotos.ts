// src/services/cloudPhotos.ts
// Servicio de fotos en la nube para GeoCam.
// Gestiona la subida, descarga y eliminación de fotos en Supabase Storage y tabla remota.
// REGLA 6: Usa ArrayBuffer para uploads (NO Blob/FormData — crea archivos de 0 bytes en RN).
// REGLA 7: Ruta de storage: ${userId}/${clientId}.jpg en bucket 'geocam'.

import { supabase } from '@/lib/supabase';

// ─── Tipos para fotos remotas de Supabase ─────────────────────────────────────

export interface RemotePhoto {
  id: number;
  user_id: string;
  client_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  taken_at: string;
  updated_at: string;
  created_at: string;
}

// ─── Funciones del servicio ───────────────────────────────────────────────────

/**
 * Sube una foto al bucket privado 'geocam' usando ArrayBuffer.
 * PROHIBIDO: Blob/FormData (crea archivos de 0 bytes en RN).
 * Ruta: ${userId}/${clientId}.jpg
 */
export async function uploadPhoto(
  userId: string,
  clientId: string,
  localUri: string
): Promise<string> {
  const path = `${userId}/${clientId}.jpg`;

  // REGLA 6: Usar ArrayBuffer, NO Blob/FormData
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('geocam')
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true, // Permite reemplazar si ya existe
    });

  if (error) throw error;
  return path;
}

/**
 * Hace upsert de los metadatos de una foto en la tabla remota public.photos.
 */
export async function upsertPhotoMetadata(data: {
  userId: string;
  clientId: string;
  storagePath: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  takenAt: string; // ISO string
  updatedAt: string; // ISO string
}): Promise<void> {
  const { error } = await supabase.from('photos').upsert(
    {
      user_id: data.userId,
      client_id: data.clientId,
      storage_path: data.storagePath,
      latitude: data.latitude,
      longitude: data.longitude,
      note: data.note,
      favorite: data.favorite,
      source: data.source,
      taken_at: data.takenAt,
      updated_at: data.updatedAt,
    },
    { onConflict: 'client_id' }
  );
  if (error) throw error;
}

/**
 * Obtiene todas las fotos remotas del usuario autenticado.
 * RLS se encarga de filtrar solo las fotos del usuario actual.
 */
export async function fetchRemotePhotos(): Promise<RemotePhoto[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .order('taken_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as RemotePhoto[];
}

/**
 * Obtiene una URL firmada temporal para visualizar una foto del bucket privado.
 * La URL expira después de 1 hora (3600 segundos).
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('geocam')
    .createSignedUrl(storagePath, 3600); // 1 hora

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Elimina una foto de la nube (storage + metadatos).
 * Primero elimina el archivo del bucket, luego los metadatos de la tabla.
 */
export async function deleteCloudPhoto(
  storagePath: string,
  clientId: string
): Promise<void> {
  // 1. Eliminar archivo del bucket
  const { error: storageError } = await supabase.storage
    .from('geocam')
    .remove([storagePath]);
  if (storageError) console.warn('Error eliminando de storage:', storageError);

  // 2. Eliminar metadatos de la tabla
  const { error: dbError } = await supabase
    .from('photos')
    .delete()
    .eq('client_id', clientId);
  if (dbError) throw dbError;
}
