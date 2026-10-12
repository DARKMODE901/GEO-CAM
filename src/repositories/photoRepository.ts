// src/repositories/photoRepository.ts
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos, type Photo, type NewPhoto } from '@/db/schema';
import { deletePhysicalPhoto, deleteAllPhysicalPhotos } from '@/services/photoStorage';

/**
 * Repositorio de Fotos (Capa 3 de la Arquitectura de 5 capas)
 * Encapsula todo el acceso a datos para la entidad Photo y coordina la eliminación física.
 */
export const photoRepository = {
  /**
   * Obtiene todas las fotos ordenadas de la más reciente a la más antigua.
   */
  async getAll(): Promise<Photo[]> {
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
  async getByAlbum(albumId: number): Promise<Photo[]> {
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
    const [created] = await db.insert(photos).values(data).returning();
    return created;
  },

  /**
   * Actualiza las notas de una foto (funcionalidad de la Migración 2).
   */
  async updateNotes(id: number, notes: string): Promise<void> {
    await db.update(photos).set({ notes }).where(eq(photos.id, id));
  },

  /**
   * Marca o desmarca una foto como favorita (funcionalidad de la Migración 2).
   */
  async toggleFavorite(id: number, isFavorite: boolean): Promise<void> {
    await db.update(photos).set({ isFavorite: isFavorite ? 1 : 0 }).where(eq(photos.id, id));
  },

  /**
   * Asigna o cambia el álbum de una foto.
   */
  async setAlbum(id: number, albumId: number | null): Promise<void> {
    await db.update(photos).set({ albumId }).where(eq(photos.id, id));
  },

  /**
   * Elimina una foto de la base de datos y su archivo físico correspondiente.
   */
  async delete(id: number): Promise<void> {
    const photo = await this.getById(id);
    if (photo) {
      // 1. Eliminar archivo físico
      await deletePhysicalPhoto(photo.uri);
      // 2. Eliminar registro en SQLite
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
