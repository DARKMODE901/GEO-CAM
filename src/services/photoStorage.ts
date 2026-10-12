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
 * 
 * Regla de la guía: "La foto física va al sistema de archivos y sus metadatos a SQLite".
 * 
 * @param tempUri URI temporal devuelta por expo-camera o expo-image-picker
 * @returns URI permanente en el sistema de archivos
 */
export async function savePhotoPermanently(tempUri: string): Promise<string> {
  await ensureDirectoryExists();

  const filename = `photo_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
  const permanentUri = `${PHOTOS_DIR}${filename}`;

  // Copiamos la imagen al almacenamiento persistente
  await FileSystem.copyAsync({
    from: tempUri,
    to: permanentUri,
  });

  return permanentUri;
}

/**
 * Elimina el archivo físico de una foto del sistema de archivos.
 * 
 * @param uri URI persistente de la foto
 */
export async function deletePhysicalPhoto(uri: string): Promise<void> {
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
