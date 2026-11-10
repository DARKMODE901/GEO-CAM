// src/repositories/syncMetaRepository.ts
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { syncMeta } from '@/db/schema';

export interface SyncItemError {
  clientId: string;
  photoId?: number;
  phase: 'pull' | 'push';
  message: string;
  timestamp: string;
}

export interface SyncResultMetadata {
  timestamp: string;
  pulled: number;
  pushed: number;
  failed: number;
  cursor: string | null;
}

export interface SyncMonitorSnapshot {
  pullCursor: string | null;
  lastSyncResult: SyncResultMetadata | null;
  errors: SyncItemError[];
}

const DEFAULT_PULL_CURSOR = '1970-01-01T00:00:00.000Z';

function keyPullCursor(userId: string) {
  return `pull_cursor:${userId}`;
}

function keyLastSyncResult(userId: string) {
  return `last_sync_result:${userId}`;
}

function keySyncErrors(userId: string) {
  return `sync_errors:${userId}`;
}

/**
 * Repositorio para la tabla SQLite `sync_meta` (key/value).
 * Almacena el cursor de bajada (server_updated_at), estadísticas del último ciclo
 * y los errores registrados por elemento sin usar comandos SQL DELETE.
 */
export const syncMetaRepository = {
  async get(key: string): Promise<string | null> {
    const rows = await db
      .select()
      .from(syncMeta)
      .where(eq(syncMeta.key, key))
      .limit(1);
    return rows[0]?.value ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    await db
      .insert(syncMeta)
      .values({ key, value })
      .onConflictDoUpdate({
        target: syncMeta.key,
        set: { value },
      });
  },

  async getPullCursor(userId: string): Promise<string> {
    const stored = await this.get(keyPullCursor(userId));
    return stored ?? DEFAULT_PULL_CURSOR;
  },

  async setPullCursor(userId: string, serverUpdatedAt: string): Promise<void> {
    await this.set(keyPullCursor(userId), serverUpdatedAt);
  },

  async saveLastSyncResult(userId: string, result: SyncResultMetadata): Promise<void> {
    await this.set(keyLastSyncResult(userId), JSON.stringify(result));
  },

  async getLastSyncResult(userId: string): Promise<SyncResultMetadata | null> {
    const raw = await this.get(keyLastSyncResult(userId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SyncResultMetadata;
    } catch {
      return null;
    }
  },

  async saveErrors(userId: string, errors: SyncItemError[]): Promise<void> {
    // Mantiene los últimos 50 errores para inspección en Monitor UI
    const trimmed = errors.slice(-50);
    await this.set(keySyncErrors(userId), JSON.stringify(trimmed));
  },

  async getErrors(userId: string): Promise<SyncItemError[]> {
    const raw = await this.get(keySyncErrors(userId));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SyncItemError[]) : [];
    } catch {
      return [];
    }
  },

  async clearErrors(userId: string): Promise<void> {
    await this.set(keySyncErrors(userId), '[]');
  },

  async getSnapshot(userId: string): Promise<SyncMonitorSnapshot> {
    const [rawCursor, lastSyncResult, errors] = await Promise.all([
      this.get(keyPullCursor(userId)),
      this.getLastSyncResult(userId),
      this.getErrors(userId),
    ]);

    return {
      pullCursor: rawCursor,
      lastSyncResult,
      errors,
    };
  },
};
