ALTER TABLE `photos` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `is_favorite` integer DEFAULT 0 NOT NULL;