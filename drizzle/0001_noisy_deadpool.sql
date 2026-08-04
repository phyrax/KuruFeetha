CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`platform` text NOT NULL,
	`push_token` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`topics` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_push_token_unique` ON `devices` (`push_token`);
--> statement-breakpoint
INSERT OR IGNORE INTO `sources` (`id`,`name`,`domain`,`language`,`ingestion_method`,`feed_url`,`poll_minutes`,`image_use_allowed`,`enabled`,`created_at`,`updated_at`) VALUES
  ('source_tnn_en','TNN English','tnn.mv','en','rss','https://tnn.mv/en/rss/latest-posts',15,0,1,1785868000000,1785868000000);
--> statement-breakpoint
INSERT OR IGNORE INTO `categories` (`id`,`slug`,`name_en`,`name_dv`,`enabled`,`sort_order`) VALUES
  ('cat_maldives','maldives','Maldives','ދިވެހިރާއްޖެ',1,1),
  ('cat_politics','politics','Politics','ސިޔާސީ',1,2),
  ('cat_business','business','Business','ވިޔަފާރި',1,3),
  ('cat_world','world','World','ދުނިޔެ',1,4),
  ('cat_sports','sports','Sports','ކުޅިވަރު',1,5),
  ('cat_lifestyle','lifestyle','Lifestyle','ދިރިއުޅުން',1,6),
  ('cat_technology','technology','Technology','ޓެކްނޮލޮޖީ',1,7),
  ('cat_entertainment','entertainment','Entertainment','މަޖާ',1,8);
