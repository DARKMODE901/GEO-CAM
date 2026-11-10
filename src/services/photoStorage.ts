// src/services/photoStorage.ts
import * as FileSystem from 'expo-file-system/legacy';

const PHOTOS_DIR = `${FileSystem.documentDirectory ?? ''}geocam_photos/`;

/**
 * Garantiza que el directorio de fotos permanentes exista en el sistema de archivos del dispositivo.
 */
async function ensureDirectoryExists(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

/**
 * Mueve/copia una foto desde la caché temporal (cámara o galería)
 * hacia el almacenamiento permanente de la aplicación (documentDirectory).
 */
export async function savePhotoPermanently(tempUri: string): Promise<string> {
  await ensureDirectoryExists();

  const filename = `photo_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
  const permanentUri = `${PHOTOS_DIR}${filename}`;

  await FileSystem.copyAsync({
    from: tempUri,
    to: permanentUri,
  });

  return permanentUri;
}

/**
 * Descarga una foto desde una URL firmada de Supabase Storage hacia el directorio permanente local.
 * Verifica integridad de la descarga (> 0 bytes y código HTTP 2xx).
 */
export async function downloadPhotoFromUrl(
  signedUrl: string,
  clientId: string
): Promise<string> {
  await ensureDirectoryExists();

  const filename = `remote_${clientId}_${Date.now()}.jpg`;
  const permanentUri = `${PHOTOS_DIR}${filename}`;

  const result = await FileSystem.downloadAsync(signedUrl, permanentUri);
  if (result.status < 200 || result.status >= 300) {
    await deletePhysicalPhoto(permanentUri);
    throw new Error(`Descarga fallida con código HTTP ${result.status}`);
  }

  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || (typeof info.size === 'number' && info.size <= 0)) {
    await deletePhysicalPhoto(result.uri);
    throw new Error('El archivo descargado está vacío (0 bytes).');
  }

  return result.uri;
}

/**
 * Verifica si el archivo físico local existe y no está vacío.
 */
export async function localFileExists(uri: string): Promise<boolean> {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return Boolean(info.exists && (info.size === undefined || info.size > 0));
  } catch {
    return false;
  }
}

/**
 * Elimina el archivo físico de una foto del sistema de archivos.
 */
export async function deletePhysicalPhoto(uri: string): Promise<void> {
  if (!uri) return;
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (error) {
    console.warn(`[photoStorage] Error al eliminar archivo físico ${uri}:`, error);
  }
}

/**
 * Elimina todas las fotos físicas almacenadas en el directorio permanente.
 */
export async function deleteAllPhysicalPhotos(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(PHOTOS_DIR, { idempotent: true });
      await ensureDirectoryExists();
    }
  } catch (error) {
    console.warn('[photoStorage] Error al limpiar directorio de fotos:', error);
  }
}
