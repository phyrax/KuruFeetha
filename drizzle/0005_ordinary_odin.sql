CREATE INDEX `idx_galleries_language_status_published` ON `galleries` (`language`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_gallery_images_gallery_order` ON `gallery_images` (`gallery_id`,`sort_order`);
--> statement-breakpoint
PRAGMA optimize;
