// src/repositories/albumRepository.ts
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, type Album, type NewAlbum } from '@/db/schema';

/**
 * Repositorio de Álbumes (Capa 3 de la Arquitectura de 5 capas)
 * Encapsula todo el acceso a datos para la entidad Album.
 */
export const albumRepository = {
  /**
   * Obtiene todos los álbumes ordenados del más reciente al más antiguo.
   */
  async getAll(): Promise<Album[]> {
    return db.select().from(albums).orderBy(desc(albums.createdAt));
  },

  /**
   * Obtiene un álbum por su ID.
   */
  async getById(id: number): Promise<Album | undefined> {
    const results = await db.select().from(albums).where(eq(albums.id, id)).limit(1);
    return results[0];
  },

  /**
   * Crea un nuevo álbum.
   */
  async create(name: string, description?: string): Promise<Album> {
    const [created] = await db
      .insert(albums)
      .values({
        name,
        description: description ?? null,
        createdAt: Date.now(),
      })
      .returning();
    return created;
  },

  /**
   * Elimina un álbum por su ID.
   * Debido a onDelete: 'set null', las fotos asociadas no se borran sino que quedan sin álbum.
   */
  async delete(id: number): Promise<void> {
    await db.delete(albums).where(eq(albums.id, id));
  },
};

