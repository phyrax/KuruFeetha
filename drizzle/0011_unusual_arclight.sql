CREATE TABLE `advertisers` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`display_name` text NOT NULL,
	`billing_email` text NOT NULL,
	`billing_phone` text,
	`industry` text,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	`tourism_licence` text,
	`agreement_reference` text,
	`political_purchaser_name` text,
	`political_funding_entity` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_key` text NOT NULL,
	`anonymous_id` text NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`type` text NOT NULL,
	`language` text NOT NULL,
	`platform` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_events_event_key_unique` ON `content_events` (`event_key`);--> statement-breakpoint
CREATE INDEX `idx_content_events_report` ON `content_events` (`content_type`,`content_id`,`type`,`created_at`);--> statement-breakpoint
ALTER TABLE `campaign_events` ADD `event_key` text;--> statement-breakpoint
UPDATE `campaign_events` SET `event_key`=`id` WHERE `event_key` IS NULL;--> statement-breakpoint
ALTER TABLE `campaign_events` ADD `placement` text DEFAULT 'feed' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign_events` ADD `language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign_events` ADD `platform` text DEFAULT 'web' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_events_event_key_unique` ON `campaign_events` (`event_key`);--> statement-breakpoint
CREATE INDEX `idx_campaign_events_report` ON `campaign_events` (`campaign_id`,`type`,`created_at`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `advertiser_id` text REFERENCES advertisers(id);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `paid_for_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `package` text DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `creative_type` text DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `category_id` text REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `placement` text DEFAULT 'feed' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `platform` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `is_political` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `owner_approved_at` integer;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `image_key` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `invoice_number` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `invoice_amount` integer;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `invoice_due_at` integer;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `payment_status` text DEFAULT 'unbilled' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `internal_notes` text;--> statement-breakpoint
CREATE INDEX `idx_campaigns_delivery` ON `campaigns` (`status`,`starts_at`,`ends_at`,`language`);
