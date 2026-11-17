// src/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Tabla de Álbumes
 */
export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
});

/**
 * Tabla de Fotos con metadatos y geolocalización
 * Incluye campos de persistencia offline (Semana 7) y sincronización con Supabase (Semana 8)
 */
export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: text('client_id').notNull().$defaultFn(() => generateUUID()),
  uri: text('uri').notNull(), // Ruta física permanente en FileSystem.documentDirectory
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracy: real('accuracy'),
  altitude: real('altitude'),
  source: text('source').$type<'camera' | 'gallery'>().notNull(),
  albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }),
  notes: text('notes'), // Agregado en Migración 2
  isFavorite: integer('is_favorite').default(0).notNull(), // Agregado en Migración 2 (0 = false, 1 = true)
  createdAt: integer('created_at').notNull(),
  // Campos de sincronización con Supabase (Migración 3 - Semana 8)
  updatedAt: integer('updated_at').default(0).notNull(),
  remotePath: text('remote_path'),
  syncedAt: integer('synced_at'),
  ownerId: text('owner_id'),
  // Borrado lógico sincronizado (Migración 4 - Sync Bidireccional)
  deletedAt: integer('deleted_at'),
  // Descripción generada por IA (Semana 10 - T3)
  aiDescription: text('ai_description'),
});

/**
 * Tabla de metadatos de sincronización (cursor de bajada, estadísticas y errores).
 */
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * Tabla de Mensajes del Chat con el Tutor IA (Persistencia SQLite - Semana 10 C1)
 */
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  parts: text('parts'), // Serialización JSON de los parts de UIMessage
  createdAt: integer('created_at').notNull(),
});

/**
 * Relaciones entre tablas (Drizzle ORM)
 */
export const albumsRelations = relations(albums, ({ many }) => ({
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  album: one(albums, {
    fields: [photos.albumId],
    references: [albums.id],
  }),
}));

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;

export type SyncMeta = typeof syncMeta.$inferSelect;
export type NewSyncMeta = typeof syncMeta.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

