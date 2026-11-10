// src/hooks/useDatabaseMigrations.ts
// Encapsula la ejecución de migraciones Drizzle en SQLite para evitar importar Drizzle en pantallas.

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '@/db/client';
import migrations from '@/drizzle/migrations';

export function useDatabaseMigrations() {
  return useMigrations(db, migrations);
}
