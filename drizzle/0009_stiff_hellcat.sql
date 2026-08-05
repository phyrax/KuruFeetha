ALTER TABLE `news_cards` ADD `is_important` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_breaking` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_important` integer DEFAULT false NOT NULL;