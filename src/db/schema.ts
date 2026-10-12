// src/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

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
 * Incluye campos agregados en la Migración 2: notes y isFavorite
 */
export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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

