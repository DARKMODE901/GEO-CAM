// src/hooks/useSync.ts
// Hook de sincronización automática y monitoreo basado en TanStack Query v5 + SQLite sync_meta.
// Reglas aplicadas:
// - Sintaxis de objeto TanStack Query v5 (useQuery({ queryKey, queryFn, ... }))
// - refetchOnReconnect: 'always' y refetchOnWindowFocus: 'always'
// - Lectura reactiva desde SQLite sync_meta y estado local pendiente

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq, isNull, or } from 'drizzle-orm';
import * as Network from 'expo-network';
import { db } from '@/db/client';
import { photos, syncMeta } from '@/db/schema';
import {
  isPhotoPendingSync,
  type SyncPendingCounts,
} from '@/repositories/photoRepository';
import {
  syncMetaRepository,
  type SyncItemError,
  type SyncResultMetadata,
} from '@/repositories/syncMetaRepository';
import { runSyncCycle, type SyncCycleResult } from '@/services/syncService';

export interface SyncMonitorState {
  status: 'pending' | 'error' | 'success';
  fetchStatus: 'fetching' | 'paused' | 'idle';
  isSyncing: boolean;
  queryError: Error | null;
  pendingStats: SyncPendingCounts;
  pullCursor: string | null;
  lastSyncResult: SyncResultMetadata | null;
  errors: SyncItemError[];
}

export function useSync(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  // Observadores reactivos directos sobre SQLite (sync_meta y photos)
  const { data: metaRows } = useLiveQuery(db.select().from(syncMeta));
  const { data: photoRows } = useLiveQuery(
    userId
      ? db
          .select()
          .from(photos)
          .where(or(eq(photos.ownerId, userId), isNull(photos.ownerId)))
      : db.select().from(photos).where(isNull(photos.id)),
    [userId]
  );

  const syncQuery = useQuery<SyncCycleResult, Error>({
    queryKey: ['sync', userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('Usuario no autenticado.');
      }
      const result = await runSyncCycle(userId);
      if (result.pulled > 0 || result.pushed > 0) {
        await queryClient.invalidateQueries({ queryKey: ['posts-feed'] });
      }
      return result;
    },
    enabled: Boolean(userId),
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });

  const { pullCursor, lastSyncResult, errors } = useMemo(() => {
    if (!userId || !metaRows) {
      return {
        pullCursor: null as string | null,
        lastSyncResult: null as SyncResultMetadata | null,
        errors: [] as SyncItemError[],
      };
    }

    const cursorKey = `pull_cursor:${userId}`;
    const resultKey = `last_sync_result:${userId}`;
    const errorsKey = `sync_errors:${userId}`;

    let cursor: string | null = null;
    let parsedResult: SyncResultMetadata | null = null;
    let parsedErrors: SyncItemError[] = [];

    for (const row of metaRows) {
      if (row.key === cursorKey) {
        cursor = row.value;
      } else if (row.key === resultKey) {
        try {
          parsedResult = JSON.parse(row.value) as SyncResultMetadata;
        } catch {
          parsedResult = null;
        }
      } else if (row.key === errorsKey) {
        try {
          const parsed = JSON.parse(row.value);
          parsedErrors = Array.isArray(parsed) ? (parsed as SyncItemError[]) : [];
        } catch {
          parsedErrors = [];
        }
      }
    }

    return {
      pullCursor: cursor,
      lastSyncResult: parsedResult,
      errors: parsedErrors,
    };
  }, [metaRows, userId]);

  const pendingStats: SyncPendingCounts = useMemo(() => {
    const list = photoRows ?? [];
    let pendingUploads = 0;
    let pendingDeletes = 0;
    let syncedCount = 0;
    let totalActive = 0;

    for (const p of list) {
      const pending = isPhotoPendingSync(p);
      if (p.deletedAt !== null) {
        if (pending) pendingDeletes++;
      } else {
        totalActive++;
        if (pending) {
          pendingUploads++;
        } else {
          syncedCount++;
        }
      }
    }

    return {
      totalPending: pendingUploads + pendingDeletes,
      pendingUploads,
      pendingDeletes,
      syncedCount,
      totalActive,
    };
  }, [photoRows]);

  const forceSync = useCallback(async (): Promise<SyncCycleResult | null> => {
    if (!userId) {
      throw new Error('Debes iniciar sesión para sincronizar con Supabase.');
    }

    const net = await Network.getNetworkStateAsync();
    const online = Boolean(net.isConnected && net.isInternetReachable !== false);
    if (!online) {
      throw new Error(
        'Sin conexión a internet. Los cambios permanecen seguros en SQLite y se sincronizarán al reconectar.'
      );
    }

    const result = await syncQuery.refetch({ throwOnError: true });
    return result.data ?? null;
  }, [userId, syncQuery]);

  const clearSyncErrors = useCallback(async (): Promise<void> => {
    if (!userId) return;
    await syncMetaRepository.clearErrors(userId);
  }, [userId]);

  const monitorState: SyncMonitorState = {
    status: syncQuery.status,
    fetchStatus: syncQuery.fetchStatus,
    isSyncing: syncQuery.isFetching,
    queryError: syncQuery.error,
    pendingStats,
    pullCursor,
    lastSyncResult,
    errors,
  };

  return {
    monitorState,
    forceSync,
    clearSyncErrors,
    syncQuery,
  };
}
