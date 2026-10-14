// src/repositories/photoRepository.ts
import { eq, desc, and, or, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos, type Photo, type NewPhoto } from '@/db/schema';
import { deletePhysicalPhoto, deleteAllPhysicalPhotos } from '@/services/photoStorage';
import { deleteCloudPhoto } from '@/services/cloudPhotos';
import * as Crypto from 'expo-crypto';

/**
 * Repositorio de Fotos (Capa 3 de la Arquitectura de 5 capas)
 * Encapsula todo el acceso a datos para la entidad Photo, coordina la eliminación física
 * y maneja el estado de sincronización local/nube.
 */
export const photoRepository = {
  /**
   * Obtiene todas las fotos, opcionalmente filtradas por ownerId (C5 - Multi-usuario).
   */
  async getAll(ownerId?: string | null): Promise<Photo[]> {
    if (ownerId) {
      return db
        .select()
        .from(photos)
        .where(or(eq(photos.ownerId, ownerId), isNull(photos.ownerId)))
        .orderBy(desc(photos.createdAt));
    }
    return db.select().from(photos).orderBy(desc(photos.createdAt));
  },

  /**
   * Obtiene una foto por su ID.
   */
  async getById(id: number): Promise<Photo | undefined> {
    const results = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
    return results[0];
  },

  /**
   * Obtiene todas las fotos de un álbum específico.
   */
  async getByAlbum(albumId: number, ownerId?: string | null): Promise<Photo[]> {
    if (ownerId) {
      return db
        .select()
        .from(photos)
        .where(and(eq(photos.albumId, albumId), or(eq(photos.ownerId, ownerId), isNull(photos.ownerId))))
        .orderBy(desc(photos.createdAt));
    }
    return db
      .select()
      .from(photos)
      .where(eq(photos.albumId, albumId))
      .orderBy(desc(photos.createdAt));
  },

  /**
   * Inserta un nuevo registro de foto en SQLite.
   * La URI ya debe ser la ruta permanente en documentDirectory.
   */
  async create(data: Omit<NewPhoto, 'id'>): Promise<Photo> {
    const clientId = data.clientId || Crypto.randomUUID();
    const now = Date.now();
    const [created] = await db
      .insert(photos)
      .values({
        ...data,
        clientId,
        updatedAt: now,
      })
      .returning();
    return created;
  },

  /**
   * Actualiza las notas de una foto y actualiza el timestamp updatedAt.
   */
  async updateNotes(id: number, notes: string): Promise<void> {
    await db.update(photos).set({ notes, updatedAt: Date.now() }).where(eq(photos.id, id));
  },

  /**
   * Alterna favorita y actualiza el timestamp updatedAt.
   */
  async toggleFavorite(id: number, isFavorite: boolean): Promise<void> {
    await db
      .update(photos)
      .set({ isFavorite: isFavorite ? 1 : 0, updatedAt: Date.now() })
      .where(eq(photos.id, id));
  },

  /**
   * Asigna o cambia el álbum de una foto y actualiza el timestamp updatedAt.
   */
  async setAlbum(id: number, albumId: number | null): Promise<void> {
    await db.update(photos).set({ albumId, updatedAt: Date.now() }).where(eq(photos.id, id));
  },

  /**
   * Marca una foto como sincronizada con Supabase.
   */
  async markSynced(id: number, remotePath: string, syncedAt: number, ownerId?: string): Promise<void> {
    await db
      .update(photos)
      .set({
        remotePath,
        syncedAt,
        ...(ownerId ? { ownerId } : {}),
      })
      .where(eq(photos.id, id));
  },

  /**
   * Garantiza que todas las fotos existentes tengan un clientId válido y updatedAt.
   */
  async ensureSyncFields(): Promise<void> {
    const all = await db.select().from(photos);
    for (const p of all) {
      if (!p.clientId || p.clientId.trim() === '') {
        await db
          .update(photos)
          .set({ clientId: Crypto.randomUUID(), updatedAt: p.createdAt })
          .where(eq(photos.id, p.id));
      }
    }
  },

  /**
   * Elimina una foto de la base de datos local, su archivo físico y opcionalmente de Supabase (C3).
   */
  async delete(id: number, deleteFromCloud = true): Promise<void> {
    const photo = await this.getById(id);
    if (photo) {
      // 1. Eliminar de la nube si está sincronizada y se solicitó
      if (deleteFromCloud && photo.remotePath && photo.clientId) {
        try {
          await deleteCloudPhoto(photo.remotePath, photo.clientId);
        } catch (cloudErr) {
          console.warn('[photoRepository] Error al eliminar de la nube:', cloudErr);
        }
      }
      // 2. Eliminar archivo físico
      await deletePhysicalPhoto(photo.uri);
      // 3. Eliminar registro en SQLite
      await db.delete(photos).where(eq(photos.id, id));
    }
  },

  /**
   * Elimina todas las fotos de la base de datos y todos sus archivos físicos.
   */
  async deleteAll(): Promise<void> {
    // 1. Eliminar archivos físicos
    await deleteAllPhysicalPhotos();
    // 2. Eliminar registros en SQLite
    await db.delete(photos);
  },
};
