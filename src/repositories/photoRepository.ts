// src/repositories/photoRepository.ts
import { eq, desc, asc, and, or, isNull, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos, type Photo, type NewPhoto } from '@/db/schema';
import * as Crypto from 'expo-crypto';

export interface SyncPendingCounts {
  totalPending: number;
  pendingUploads: number;
  pendingDeletes: number;
  syncedCount: number;
  totalActive: number;
}

/**
 * Determina si un registro local está pendiente de sincronizar.
 * Regla de negocio: syncedAt es null o es anterior a updatedAt.
 */
export function isPhotoPendingSync(photo: Pick<Photo, 'syncedAt' | 'updatedAt'>): boolean {
  return photo.syncedAt === null || photo.syncedAt < photo.updatedAt;
}

/**
 * Repositorio de Fotos (Capa 3 de la Arquitectura de 5 capas)
 * SQLite es la fuente de verdad absoluta: las escrituras son locales e instantáneas.
 * PROHIBIDO ejecutar comandos SQL DELETE directos: siempre se usa borrado lógico (deletedAt).
 */
export const photoRepository = {
  /**
   * Obtiene todas las fotos activas (deletedAt IS NULL), filtradas por ownerId.
   */
  async getAll(ownerId?: string | null): Promise<Photo[]> {
    const activeFilter = isNull(photos.deletedAt);
    if (ownerId) {
      return db
        .select()
        .from(photos)
        .where(and(activeFilter, or(eq(photos.ownerId, ownerId), isNull(photos.ownerId))))
        .orderBy(desc(photos.createdAt));
    }
    return db.select().from(photos).where(activeFilter).orderBy(desc(photos.createdAt));
  },

  /**
   * Obtiene una foto por su ID local.
   */
  async getById(id: number): Promise<Photo | undefined> {
    const results = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
    return results[0];
  },

  /**
   * Busca una foto local por su clientId (UUID compartido), incluyendo tombstones (borrado lógico).
   */
  async getByClientId(clientId: string): Promise<Photo | undefined> {
    const results = await db
      .select()
      .from(photos)
      .where(eq(photos.clientId, clientId))
      .limit(1);
    return results[0];
  },

  /**
   * Obtiene todas las fotos activas de un álbum específico.
   */
  async getByAlbum(albumId: number, ownerId?: string | null): Promise<Photo[]> {
    const activeAlbumFilter = and(eq(photos.albumId, albumId), isNull(photos.deletedAt));
    if (ownerId) {
      return db
        .select()
        .from(photos)
        .where(and(activeAlbumFilter, or(eq(photos.ownerId, ownerId), isNull(photos.ownerId))))
        .orderBy(desc(photos.createdAt));
    }
    return db
      .select()
      .from(photos)
      .where(activeAlbumFilter)
      .orderBy(desc(photos.createdAt));
  },

  /**
   * Obtiene todas las fotos pendientes de subir (activas o borradas lógicamente).
   * Pendiente: syncedAt IS NULL o syncedAt < updatedAt.
   */
  async getPendingSync(ownerId: string): Promise<Photo[]> {
    return db
      .select()
      .from(photos)
      .where(
        and(
          or(eq(photos.ownerId, ownerId), isNull(photos.ownerId)),
          or(isNull(photos.syncedAt), lt(photos.syncedAt, photos.updatedAt))
        )
      )
      .orderBy(asc(photos.updatedAt));
  },

  /**
   * Calcula estadísticas locales de sincronización para el Monitor de Estado UI.
   */
  async getSyncStats(ownerId: string): Promise<SyncPendingCounts> {
    const rows = await db
      .select()
      .from(photos)
      .where(or(eq(photos.ownerId, ownerId), isNull(photos.ownerId)));

    let pendingUploads = 0;
    let pendingDeletes = 0;
    let syncedCount = 0;
    let totalActive = 0;

    for (const p of rows) {
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
  },

  /**
   * Inserta un nuevo registro de foto en SQLite.
   */
  async create(data: Omit<NewPhoto, 'id'>): Promise<Photo> {
    const clientId = data.clientId || Crypto.randomUUID();
    const now = Date.now();
    const [created] = await db
      .insert(photos)
      .values({
        ...data,
        clientId,
        updatedAt: data.updatedAt ?? now,
        deletedAt: data.deletedAt ?? null,
      })
      .returning();
    return created;
  },

  /**
   * Inserta una foto descargada desde Supabase durante la fase Pull.
   * Iguala syncedAt exactamente con updatedAt remoto para no quedar pendiente.
   */
  async createFromRemote(data: {
    clientId: string;
    uri: string;
    latitude: number | null;
    longitude: number | null;
    source: 'camera' | 'gallery';
    notes: string | null;
    isFavorite: boolean;
    createdAtMs: number;
    remoteUpdatedAtMs: number;
    remotePath: string;
    ownerId: string;
    deletedAtMs?: number | null;
  }): Promise<Photo> {
    const [created] = await db
      .insert(photos)
      .values({
        clientId: data.clientId,
        uri: data.uri,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: null,
        altitude: null,
        source: data.source,
        albumId: null,
        notes: data.notes,
        isFavorite: data.isFavorite ? 1 : 0,
        createdAt: data.createdAtMs,
        updatedAt: data.remoteUpdatedAtMs,
        syncedAt: data.remoteUpdatedAtMs,
        remotePath: data.remotePath,
        ownerId: data.ownerId,
        deletedAt: data.deletedAtMs ?? null,
      })
      .returning();
    return created;
  },

  /**
   * Aplica cambios remotos cuando remoteWins(localUpdatedAt, remoteUpdatedAt) es true.
   * Iguala las fechas locales (updatedAt y syncedAt) al updated_at remoto.
   */
  async applyRemoteUpdate(
    id: number,
    data: {
      uri?: string;
      latitude: number | null;
      longitude: number | null;
      notes: string | null;
      isFavorite: boolean;
      remotePath: string;
      ownerId: string;
      remoteUpdatedAtMs: number;
      deletedAtMs: number | null;
    }
  ): Promise<void> {
    await db
      .update(photos)
      .set({
        ...(data.uri ? { uri: data.uri } : {}),
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes,
        isFavorite: data.isFavorite ? 1 : 0,
        remotePath: data.remotePath,
        ownerId: data.ownerId,
        updatedAt: data.remoteUpdatedAtMs,
        syncedAt: data.remoteUpdatedAtMs,
        deletedAt: data.deletedAtMs,
      })
      .where(eq(photos.id, id));
  },

  /**
   * Actualiza las notas de una foto y actualiza updatedAt.
   */
  async updateNotes(id: number, notes: string): Promise<void> {
    await db.update(photos).set({ notes, updatedAt: Date.now() }).where(eq(photos.id, id));
  },

  /**
   * Alterna favorita y actualiza updatedAt.
   */
  async toggleFavorite(id: number, isFavorite: boolean): Promise<void> {
    await db
      .update(photos)
      .set({ isFavorite: isFavorite ? 1 : 0, updatedAt: Date.now() })
      .where(eq(photos.id, id));
  },

  /**
   * Asigna o cambia el álbum de una foto y actualiza updatedAt.
   */
  async setAlbum(id: number, albumId: number | null): Promise<void> {
    await db.update(photos).set({ albumId, updatedAt: Date.now() }).where(eq(photos.id, id));
  },

  /**
   * Marca una foto como sincronizada reemplazando syncedAt EXACTAMENTE con el valor
   * updatedAt que se acaba de subir (jamás usa la fecha actual del reloj).
   */
  async markSynced(
    id: number,
    remotePath: string | null,
    uploadedUpdatedAt: number,
    ownerId?: string
  ): Promise<void> {
    await db
      .update(photos)
      .set({
        ...(remotePath !== null ? { remotePath } : {}),
        syncedAt: uploadedUpdatedAt,
        ...(ownerId ? { ownerId } : {}),
      })
      .where(eq(photos.id, id));
  },

  /**
   * Garantiza que todas las fotos existentes tengan un clientId válido, updatedAt
   * y ownerId inferido si ya poseen remotePath (${userId}/${clientId}.jpg).
   */
  async ensureSyncFields(): Promise<void> {
    const all = await db.select().from(photos);
    for (const p of all) {
      const candidateOwner =
        !p.ownerId && p.remotePath && p.remotePath.includes('/')
          ? p.remotePath.split('/')[0]
          : null;
      const inferredOwner =
        candidateOwner && /^[0-9a-f-]{36}$/i.test(candidateOwner)
          ? candidateOwner
          : null;

      if (!p.clientId || p.clientId.trim() === '' || !p.updatedAt || inferredOwner) {
        await db
          .update(photos)
          .set({
            clientId:
              p.clientId && p.clientId.trim() !== '' ? p.clientId : Crypto.randomUUID(),
            updatedAt: p.updatedAt && p.updatedAt > 0 ? p.updatedAt : p.createdAt,
            ...(inferredOwner ? { ownerId: inferredOwner } : {}),
          })
          .where(eq(photos.id, p.id));
      }
    }
  },

  /**
   * Borrado lógico de una foto por ID local.
   * Marca deletedAt y updatedAt con la fecha actual; los archivos físicos y remotos
   * se eliminarán únicamente cuando la marca de borrado sea confirmada en Push.
   */
  async delete(id: number): Promise<void> {
    const now = Date.now();
    await db
      .update(photos)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(photos.id, id));
  },

  /**
   * Borrado lógico de una foto por clientId.
   */
  async deleteByClientId(clientId: string): Promise<void> {
    const now = Date.now();
    await db
      .update(photos)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(photos.clientId, clientId));
  },

  /**
   * Borrado lógico masivo de todas las fotos activas (sin comandos SQL DELETE).
   */
  async deleteAll(ownerId?: string | null): Promise<void> {
    const now = Date.now();
    const condition = ownerId
      ? and(isNull(photos.deletedAt), or(eq(photos.ownerId, ownerId), isNull(photos.ownerId)))
      : isNull(photos.deletedAt);

    await db
      .update(photos)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(condition);
  },
};
