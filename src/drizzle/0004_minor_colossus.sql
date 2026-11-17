CREATE TABLE IF NOT EXISTS `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`parts` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `photos` ADD `ai_description` text;
