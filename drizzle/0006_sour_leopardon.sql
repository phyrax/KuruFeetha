CREATE TABLE `content_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_like_user_content_idx` ON `content_likes` (`user_id`,`content_type`,`content_id`);--> statement-breakpoint
CREATE INDEX `idx_content_likes_user_type` ON `content_likes` (`user_id`,`content_type`);--> statement-breakpoint
ALTER TABLE `galleries` ADD `category_id` text REFERENCES categories(id);
--> statement-breakpoint
UPDATE `galleries` SET `category_id`=COALESCE((SELECT `category_id` FROM `news_cards` WHERE `news_cards`.`id`=`galleries`.`related_story_id`),(SELECT `id` FROM `categories` WHERE `enabled`=1 ORDER BY `sort_order` LIMIT 1)) WHERE `category_id` IS NULL;
--> statement-breakpoint
PRAGMA optimize;
