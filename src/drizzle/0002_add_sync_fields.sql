ALTER TABLE photos ADD COLUMN client_id TEXT DEFAULT '';
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN remote_path TEXT;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN synced_at INTEGER;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN owner_id TEXT;
