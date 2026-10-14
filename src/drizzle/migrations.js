// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init_albums_and_photos.sql';
import m0001 from './0001_add_notes_and_favorites.sql';
import m0002 from './0002_add_sync_fields.sql';

  export default {
    journal,
    migrations: {
      m0000,
      m0001,
      m0002
    }
  }
  