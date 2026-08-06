ALTER TABLE `news_card_translations` ADD `article_content` text;--> statement-breakpoint
ALTER TABLE `news_card_translations` ADD `article_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `news_card_translations` ADD `article_published_at` integer;