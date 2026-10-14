ALTER TABLE photos ADD COLUMN client_id TEXT NOT NULL DEFAULT (lower(hex(randomblob(16))));
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN remote_path TEXT;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN synced_at INTEGER;
--> statement-breakpoint
ALTER TABLE photos ADD COLUMN owner_id TEXT;
