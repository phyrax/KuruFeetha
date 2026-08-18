CREATE TABLE `content_type_recommendations` (
  `story_id` text PRIMARY KEY NOT NULL,
  `content_fingerprint` text NOT NULL,
  `recommended_type` text NOT NULL CHECK (`recommended_type` IN ('news','opinion','editorial','press_release')),
  `confidence` real NOT NULL CHECK (`confidence` >= 0 AND `confidence` <= 1),
  `reason` text NOT NULL,
  `needs_human_review` integer NOT NULL DEFAULT 1 CHECK (`needs_human_review` IN (0,1)),
  `flags` text NOT NULL DEFAULT '[]' CHECK (json_valid(`flags`)),
  `language_recommendations` text NOT NULL DEFAULT '{}' CHECK (json_valid(`language_recommendations`)),
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `generated_at` integer NOT NULL,
  FOREIGN KEY (`story_id`) REFERENCES `news_cards`(`id`) ON UPDATE no action ON DELETE CASCADE
);

CREATE INDEX `idx_content_type_recommendations_generated`
  ON `content_type_recommendations` (`generated_at`);
