// src/lib/foto.ts
// Reducción y preparación multimodal de imágenes para Google Gemini (< 300 KB)

import { ImageManipulator, SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import type { FileUIPart } from 'ai';

export interface FotoReducida {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

/**
 * Reduce el peso de una fotografía local de varios MB a ~150 KB
 * Redimensiona a 1024 px de ancho con compresión JPEG 0.7 y extrae base64.
 */
export async function procesarFotoParaIA(uri: string): Promise<FotoReducida> {
  try {
    // API moderna y orientada a objetos de expo-image-manipulator (SDK 52+)
    if (ImageManipulator && typeof ImageManipulator.manipulate === 'function') {
      const context = ImageManipulator.manipulate(uri);
      context.resize({ width: 1024 });
      const imageRef = await context.renderAsync();
      const guardada = await imageRef.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.7,
        base64: true,
      });

      return {
        uri: guardada.uri,
        base64: guardada.base64 || '',
        width: guardada.width,
        height: guardada.height,
      };
    }
  } catch {
    // Fallback silencioso con manipulateAsync si la API contextual no está disponible
  }

  // Fallback con manipulateAsync
  const guardada = await manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    {
      format: SaveFormat.JPEG,
      compress: 0.7,
      base64: true,
    }
  );

  return {
    uri: guardada.uri,
    base64: guardada.base64 || '',
    width: guardada.width,
    height: guardada.height,
  };
}

/**
 * Transforma una imagen reducida en una parte de archivo válida para Vercel AI SDK v7 (FileUIPart)
 */
export async function crearParteFotoParaChat(uri: string): Promise<FileUIPart> {
  const reducida = await procesarFotoParaIA(uri);
  return {
    type: 'file',
    mediaType: 'image/jpeg',
    filename: 'foto.jpg',
    url: `data:image/jpeg;base64,${reducida.base64}`,
  };
}
