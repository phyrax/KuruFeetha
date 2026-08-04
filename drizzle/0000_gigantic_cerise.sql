CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`confidence` real,
	`input_tokens` integer,
	`output_tokens` integer,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `source_articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before` text,
	`after` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `news_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmark_user_card_idx` ON `bookmarks` (`user_id`,`card_id`);--> statement-breakpoint
CREATE TABLE `campaign_events` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`anonymous_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`sponsor_name` text NOT NULL,
	`status` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`frequency_cap` integer DEFAULT 3 NOT NULL,
	`language` text DEFAULT 'both' NOT NULL,
	`headline_en` text NOT NULL,
	`headline_dv` text NOT NULL,
	`summary_en` text NOT NULL,
	`summary_dv` text NOT NULL,
	`destination_url` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_en` text NOT NULL,
	`name_dv` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `cluster_articles` (
	`cluster_id` text NOT NULL,
	`article_id` text NOT NULL,
	FOREIGN KEY (`cluster_id`) REFERENCES `story_clusters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`article_id`) REFERENCES `source_articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`run_after` integer NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `news_card_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`language` text NOT NULL,
	`headline` text NOT NULL,
	`summary` text NOT NULL,
	`word_count` integer NOT NULL,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `news_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_language_idx` ON `news_card_translations` (`card_id`,`language`);--> statement-breakpoint
CREATE TABLE `news_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`cluster_id` text,
	`category_id` text,
	`status` text NOT NULL,
	`breaking` integer DEFAULT false NOT NULL,
	`boost` integer DEFAULT 0 NOT NULL,
	`image_url` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cluster_id`) REFERENCES `story_clusters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `source_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`canonical_url` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`content_hash` text NOT NULL,
	`published_at` integer,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_article_url_idx` ON `source_articles` (`canonical_url`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`language` text NOT NULL,
	`ingestion_method` text NOT NULL,
	`feed_url` text,
	`poll_minutes` integer DEFAULT 15 NOT NULL,
	`image_use_allowed` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_domain_unique` ON `sources` (`domain`);--> statement-breakpoint
CREATE TABLE `story_clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`representative_title` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`similarity` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'reader' NOT NULL,
	`preferred_language` text DEFAULT 'en' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);