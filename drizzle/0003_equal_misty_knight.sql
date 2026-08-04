PRAGMA foreign_keys=OFF;--> statement-breakpoint
DELETE FROM `bookmarks` WHERE `card_id` IN (SELECT `id` FROM `news_cards` WHERE `status` <> 'published');--> statement-breakpoint
DELETE FROM `news_card_translations` WHERE `card_id` IN (SELECT `id` FROM `news_cards` WHERE `status` <> 'published');--> statement-breakpoint
DELETE FROM `news_cards` WHERE `status` <> 'published';--> statement-breakpoint
DELETE FROM `audit_events` WHERE `action` LIKE 'article.%' OR `entity_type` IN ('source_article','ai_run','ingestion_job');--> statement-breakpoint
CREATE TABLE `__new_news_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`image_key` text,
	`image_url` text,
	`source_name` text,
	`source_url` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_news_cards`("id", "category_id", "status", "image_key", "image_url", "source_name", "source_url", "published_at", "created_at", "updated_at")
SELECT c."id", c."category_id", 'published', NULL, c."image_url",
  (SELECT s.name FROM cluster_articles ca JOIN source_articles a ON a.id=ca.article_id JOIN sources s ON s.id=a.source_id WHERE ca.cluster_id=c.cluster_id LIMIT 1),
  (SELECT a.canonical_url FROM cluster_articles ca JOIN source_articles a ON a.id=ca.article_id WHERE ca.cluster_id=c.cluster_id LIMIT 1),
  c."published_at", c."created_at", c."updated_at" FROM `news_cards` c;--> statement-breakpoint
DROP TABLE `news_cards`;--> statement-breakpoint
ALTER TABLE `__new_news_cards` RENAME TO `news_cards`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP TABLE `ai_runs`;--> statement-breakpoint
DROP TABLE `cluster_articles`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
DROP TABLE `source_articles`;--> statement-breakpoint
DROP TABLE `sources`;--> statement-breakpoint
DROP TABLE `story_clusters`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_subject` text,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'reader' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`preferred_language` text DEFAULT 'en' NOT NULL,
	`onboarding_completed_at` integer,
	`last_active_at` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "auth_subject", "email", "display_name", "role", "status", "preferred_language", "onboarding_completed_at", "last_active_at", "created_at", "updated_at") SELECT "id", "auth_subject", "email", "display_name", "role", "status", "preferred_language", "onboarding_completed_at", "last_active_at", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_auth_subject_unique` ON `users` (`auth_subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `news_card_translations` ADD `published_at` integer;
--> statement-breakpoint
UPDATE `news_card_translations` SET `review_status`='published', `published_at`=(SELECT `published_at` FROM `news_cards` WHERE `news_cards`.`id`=`news_card_translations`.`card_id`) WHERE `card_id` IN (SELECT `id` FROM `news_cards`);--> statement-breakpoint
PRAGMA optimize;
