// src/lib/queryClient.ts
// Configuración central de TanStack Query v5:
// - gcTime (sin cacheTime obsoleto)
// - onlineManager integrado con expo-network
// - focusManager integrado con React Native AppState
// - Persistencia offline usando @tanstack/react-query-persist-client sobre SQLite KV Store

import { QueryClient, focusManager, onlineManager, type Query } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import * as Network from 'expo-network';
import KVStore from 'expo-sqlite/kv-store';
import { AppState, Platform, type AppStateStatus } from 'react-native';

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Conecta expo-network con onlineManager de TanStack Query v5.
 * Permite pausar consultas cuando no hay conexión y reanudarlas automáticamente al reconectar.
 */
onlineManager.setEventListener((setOnline) => {
  let active = true;

  Network.getNetworkStateAsync()
    .then((state) => {
      if (!active) return;
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(isOnline);
    })
    .catch(() => {
      if (active) setOnline(true);
    });

  const subscription = Network.addNetworkStateListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    setOnline(isOnline);
  });

  return () => {
    active = false;
    subscription.remove();
  };
});

/**
 * Conecta AppState de React Native con focusManager.setFocused.
 * Dispara refetchOnWindowFocus ('always') cuando la app vuelve a primer plano.
 */
export function subscribeFocusManager(): () => void {
  const onAppStateChange = (status: AppStateStatus) => {
    if (Platform.OS !== 'web') {
      focusManager.setFocused(status === 'active');
    }
  };

  // Inicializar con el estado actual
  if (Platform.OS !== 'web') {
    focusManager.setFocused(AppState.currentState === 'active');
  }

  const subscription = AppState.addEventListener('change', onAppStateChange);
  return () => {
    subscription.remove();
  };
}

/**
 * Adaptador de almacenamiento SQLite KV Store (nativo) / localStorage (web)
 * para persistir la caché de TanStack Query offline.
 */
const queryCacheStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(key)
        : null;
    }
    return KVStore.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await KVStore.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await KVStore.removeItem(key);
  },
};

export const queryPersister = createAsyncStoragePersister({
  storage: queryCacheStorage,
  key: 'GEOCAM_REACT_QUERY_OFFLINE_CACHE',
  throttleTime: 1000,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: SEVEN_DAYS_MS, // Reemplazo estricto v5 de cacheTime
      staleTime: 1000 * 30,
      retry: 2,
    },
  },
});

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: queryPersister,
  maxAge: SEVEN_DAYS_MS,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) => {
      // Persistimos el muro remoto ('posts-feed') para disponibilidad offline,
      // excluyendo la query de control 'sync' cuyo estado vive en SQLite sync_meta.
      return query.state.status === 'success' && query.queryKey[0] !== 'sync';
    },
  },
};

/**
 * Limpia la caché en memoria y persistida al cerrar sesión.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  queryClient.clear();
  await queryPersister.removeClient();
}
