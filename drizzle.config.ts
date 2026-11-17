if (typeof (globalThis as any).__DEV__ === 'undefined') {
  (globalThis as any).__DEV__ = false;
}

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/drizzle',
  dialect: 'sqlite',
  driver: 'expo',
});

