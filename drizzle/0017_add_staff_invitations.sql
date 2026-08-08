CREATE TABLE `staff_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by` text NOT NULL,
	`delivered_at` integer,
	`accepted_at` integer,
	`revoked_at` integer,
	`delivery_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_invitation_email_idx` ON `staff_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `idx_staff_invitations_status_created` ON `staff_invitations` (`status`,`created_at`);