// src/db/client.ts
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

/**
 * Conexión nativa SQLite síncrona según estándares de Expo SDK 57.
 * Evita métodos obsoletos como SQLite.openDatabase.
 */
export const expoDb = openDatabaseSync('geocam.db', { enableChangeListener: true });

/**
 * REGLA DE ORO DE LA GUÍA:
 * Activar llaves foráneas explícitamente en la conexión SQLite.
 */
expoDb.execSync('PRAGMA foreign_keys = ON;');

/**
 * Cliente Drizzle ORM configurado con el driver oficial para Expo SQLite.
 */
export const db = drizzle(expoDb, { schema });
