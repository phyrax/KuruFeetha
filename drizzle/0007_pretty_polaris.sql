ALTER TABLE `galleries` ADD `topic_en` text;--> statement-breakpoint
ALTER TABLE `galleries` ADD `topic_dv` text;--> statement-breakpoint
ALTER TABLE `galleries` ADD `published_en` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `galleries` ADD `published_dv` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `galleries` ADD `related_story_en_id` text REFERENCES news_cards(id);--> statement-breakpoint
ALTER TABLE `galleries` ADD `related_story_dv_id` text REFERENCES news_cards(id);
--> statement-breakpoint
UPDATE `galleries` SET `topic_en`=CASE WHEN `language`='en' THEN `topic` ELSE NULL END,`topic_dv`=CASE WHEN `language`='dv' THEN `topic` ELSE NULL END,`published_en`=CASE WHEN `language`='en' AND `status`='published' THEN 1 ELSE 0 END,`published_dv`=CASE WHEN `language`='dv' AND `status`='published' THEN 1 ELSE 0 END,`related_story_en_id`=CASE WHEN `language`='en' THEN `related_story_id` ELSE NULL END,`related_story_dv_id`=CASE WHEN `language`='dv' THEN `related_story_id` ELSE NULL END;
--> statement-breakpoint
PRAGMA optimize;
