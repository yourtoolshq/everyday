CREATE TABLE `care_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone_numbers` text DEFAULT '[]' NOT NULL,
	`website_url` text,
	`booking_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`care_organization_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`care_organization_id`) REFERENCES `care_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`care_item_id` text,
	`provider_id` text,
	`care_organization_id` text,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`status` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`care_item_id`) REFERENCES `care_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`care_organization_id`) REFERENCES `care_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
ALTER TABLE `care_items` ADD `target_visit_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `care_items` ADD `not_pursuing_at` text;--> statement-breakpoint
ALTER TABLE `care_items` DROP COLUMN `status`;