// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init_albums_and_photos.sql';
import m0001 from './0001_add_notes_and_favorites.sql';

// Definición directa de m0002 para garantizar que Metro no use caché desactualizada
const m0002 = `ALTER TABLE photos ADD COLUMN client_id TEXT DEFAULT '';
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN remote_path TEXT;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN synced_at INTEGER;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN owner_id TEXT;`;

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
  },
};