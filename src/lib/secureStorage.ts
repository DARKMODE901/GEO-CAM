// src/lib/secureStorage.ts
// Adaptador de almacenamiento seguro con chunking para Supabase Auth.
// expo-secure-store tiene un límite de ~2048 bytes por entrada,
// por lo que dividimos los valores en fragmentos de 1000 bytes.

import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1000;

/**
 * Adaptador de almacenamiento seguro compatible con @supabase/supabase-js.
 * Divide valores grandes en fragmentos para no exceder el límite de SecureStore.
 */
export const secureStorage = {
  /**
   * Recupera un valor reconstruyendo todos sus fragmentos.
   */
  async getItem(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(`${key}_chunk_count`);
    if (countStr === null) {
      return null;
    }

    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) {
      return null;
    }

    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) {
        // Datos corruptos: falta un fragmento
        return null;
      }
      chunks.push(chunk);
    }

    return chunks.join('');
  },

  /**
   * Almacena un valor dividiéndolo en fragmentos de CHUNK_SIZE bytes.
   */
  async setItem(key: string, value: string): Promise<void> {
    // Primero eliminar fragmentos anteriores para evitar datos huérfanos
    await secureStorage.removeItem(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
    }

    await SecureStore.setItemAsync(`${key}_chunk_count`, chunks.length.toString());
  },

  /**
   * Elimina un valor y todos sus fragmentos asociados.
   */
  async removeItem(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(`${key}_chunk_count`);
    if (countStr === null) {
      return;
    }

    const count = parseInt(countStr, 10);
    if (!isNaN(count)) {
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      }
    }

    await SecureStore.deleteItemAsync(`${key}_chunk_count`);
  },
};
