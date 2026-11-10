// src/services/cloudPhotos.ts
// Servicio remoto de fotos en Supabase (PostgreSQL + Storage privado 'geocam').
// REGLA 6: Usa ArrayBuffer para uploads (NO Blob/FormData — evita 0 bytes en RN).
// REGLA 7: Ruta de storage: ${userId}/${clientId}.jpg en bucket privado 'geocam'.
// PROHIBIDO: No usa .range() en paginación ni comandos DELETE directos sobre fotos.

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

// ─── Funciones de Storage y Metadatos ─────────────────────────────────────────

/**
 * Sube una foto al bucket privado 'geocam' usando ArrayBuffer.
 * Ruta: ${userId}/${clientId}.jpg
 */
export async function uploadPhoto(
  userId: string,
  clientId: string,
  localUri: string
): Promise<string> {
  const path = `${userId}/${clientId}.jpg`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    throw new Error('La imagen local pesa 0 bytes y no se puede subir.');
  }

  const { error } = await supabase.storage
    .from('geocam')
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw error;
  return path;
}

/**
 * Elimina el archivo binario del bucket privado 'geocam'.
 * Debe invocarse únicamente después de confirmar el borrado lógico en public.photos.
 */
export async function removeStorageObject(storagePath: string): Promise<void> {
  if (!storagePath) return;
  const { error } = await supabase.storage.from('geocam').remove([storagePath]);
  if (error) {
    console.warn('[cloudPhotos] Error eliminando objeto de storage:', error);
  }
}

/**
 * Hace upsert de los metadatos de una foto en public.photos resolviendo conflictos por client_id.
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
  deletedAt?: string | null; // ISO string para borrado lógico
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
      deleted_at: data.deletedAt ?? null,
    },
    { onConflict: 'client_id' }
  );
  if (error) throw error;
}

/**
 * Paso 1 (Pull): Consulta cambios remotos en Supabase posteriores al cursor guardado.
 * Orden ascendente por server_updated_at con límite de lote (200 por defecto).
 */
export async function pullRemoteChangesBatch(
  userId: string,
  cursor: string,
  limit = 200
): Promise<RemotePhoto[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .gt('server_updated_at', cursor)
    .order('server_updated_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as RemotePhoto[];
}

/**
 * Obtiene una URL firmada temporal para visualizar o descargar una foto del bucket privado.
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('geocam')
    .createSignedUrl(storagePath, 3600); // 1 hora

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Paginación basada en cursor (created_at < último) para el Feed Remoto ("Nube").
 * Evita duplicados cuando ingresan fotos nuevas en tiempo real. Excluye borrados lógicos.
 */
export async function fetchRemoteFeedPage({
  userId,
  cursor,
  limit = 10,
  search = '',
}: {
  userId: string;
  cursor: string | null;
  limit?: number;
  search?: string;
}): Promise<RemoteFeedPage> {
  let query = supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const safeTerm = search.replace(/[,()]/g, ' ').trim();
  if (safeTerm.length > 0) {
    query = query.or(`note.ilike.%${safeTerm}%,source.ilike.%${safeTerm}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as RemotePhoto[];

  const items: RemotePhotoFeedItem[] = await Promise.all(
    rows.map(async (photo) => {
      try {
        const signedUrl = await getSignedUrl(photo.storage_path);
        return { ...photo, signedUrl };
      } catch {
        return { ...photo };
      }
    })
  );

  const nextCursor =
    rows.length === limit ? rows[rows.length - 1].created_at : null;

  return { items, nextCursor };
}

/**
 * Borrado lógico remoto directo (para elementos remotos sin registro local).
 * Jamás usa .delete() sobre public.photos; marca deleted_at vía upsert.
 */
export async function softDeleteRemotePhoto(photo: RemotePhoto): Promise<void> {
  const nowIso = new Date().toISOString();
  await upsertPhotoMetadata({
    userId: photo.user_id,
    clientId: photo.client_id,
    storagePath: photo.storage_path,
    latitude: photo.latitude,
    longitude: photo.longitude,
    note: photo.note,
    favorite: photo.favorite,
    source: photo.source,
    takenAt: photo.taken_at,
    updatedAt: nowIso,
    deletedAt: nowIso,
  });

  await removeStorageObject(photo.storage_path);
}
