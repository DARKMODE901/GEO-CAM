ALTER TABLE photos ADD COLUMN deleted_at INTEGER;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_photos_client_id` ON `photos` (`client_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_photos_deleted_at` ON `photos` (`deleted_at`);
