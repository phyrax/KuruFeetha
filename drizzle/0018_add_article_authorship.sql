ALTER TABLE `news_card_translations` ADD `content_type` text CHECK (`content_type` IS NULL OR `content_type` IN ('news','opinion','editorial','press_release'));--> statement-breakpoint
CREATE TABLE `authors` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL CHECK (`kind` IN ('person','organization')),
	`slug` text,
	`status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active','inactive')),
	`name_en` text,
	`name_dv` text,
	`bio_en` text,
	`bio_dv` text,
	`public_profile_enabled` integer DEFAULT 0 NOT NULL CHECK (`public_profile_enabled` IN (0,1)),
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CHECK (length(trim(COALESCE(`name_en`,''))) > 0 OR length(trim(COALESCE(`name_dv`,''))) > 0),
	CHECK (`public_profile_enabled` = 0 OR length(trim(COALESCE(`slug`,''))) > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `authors_slug_idx` ON `authors` (`slug`) WHERE `slug` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_authors_status_kind` ON `authors` (`status`,`kind`);--> statement-breakpoint
CREATE TABLE `article_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`translation_id` text NOT NULL,
	`author_id` text NOT NULL,
	`role` text DEFAULT 'author' NOT NULL CHECK (`role` = 'author'),
	`sort_order` integer DEFAULT 0 NOT NULL CHECK (`sort_order` >= 0),
	`created_at` integer NOT NULL,
	FOREIGN KEY (`translation_id`) REFERENCES `news_card_translations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
CREATE UNIQUE INDEX `article_credit_translation_author_role_idx` ON `article_credits` (`translation_id`,`author_id`,`role`);--> statement-breakpoint
CREATE INDEX `idx_article_credits_translation_order` ON `article_credits` (`translation_id`,`sort_order`);
