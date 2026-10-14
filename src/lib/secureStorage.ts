// src/lib/secureStorage.ts
// Adaptador de almacenamiento seguro con chunking para Supabase Auth.
// expo-secure-store tiene un límite de ~2048 bytes por entrada,
// por lo que dividimos los valores en fragmentos de 1000 bytes.
// En Web utiliza localStorage de forma transparente.

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }

      const countStr = await SecureStore.getItemAsync(`${key}_chunk_count`);
      if (countStr === null) {
        // Fallback para claves sin fragmentar
        return await SecureStore.getItemAsync(key);
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
    } catch (err) {
      console.warn('[secureStorage] Error recuperando clave:', key, err);
      return null;
    }
  },

  /**
   * Almacena un valor dividiéndolo en fragmentos de CHUNK_SIZE bytes.
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }

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
    } catch (err) {
      console.warn('[secureStorage] Error guardando clave:', key, err);
    }
  },

  /**
   * Elimina un valor y todos sus fragmentos asociados.
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }

      const countStr = await SecureStore.getItemAsync(`${key}_chunk_count`);
      if (countStr !== null) {
        const count = parseInt(countStr, 10);
        if (!isNaN(count)) {
          for (let i = 0; i < count; i++) {
            await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
          }
        }
        await SecureStore.deleteItemAsync(`${key}_chunk_count`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.warn('[secureStorage] Error eliminando clave:', key, err);
    }
  },
};
