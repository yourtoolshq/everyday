CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`event_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`document_date` text,
	`notes` text,
	`file_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `property_events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`file_id`) REFERENCES `yt_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_file_unique` ON `documents` (`file_id`);--> statement-breakpoint
CREATE INDEX `documents_property_id_idx` ON `documents` (`property_id`);--> statement-breakpoint
CREATE INDEX `documents_event_id_idx` ON `documents` (`event_id`);--> statement-breakpoint
CREATE TABLE `yt_files` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text,
	`endpoint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `yt_files_storage_key_unique` ON `yt_files` (`storage_key`);--> statement-breakpoint
CREATE TABLE `yt_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`region` text,
	`postal_code` text,
	`move_in_date` text,
	`move_out_date` text,
	`lease_start_date` text,
	`lease_end_date` text,
	`lease_notes` text,
	`landlord_name` text,
	`landlord_email` text,
	`landlord_phone` text,
	`renter_insurance_provider` text,
	`renter_insurance_policy_number` text,
	`renter_insurance_expires_on` text,
	`target_possession_date` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `properties_kind_idx` ON `properties` (`kind`);--> statement-breakpoint
CREATE TABLE `property_events` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`event_date` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `property_events_property_id_idx` ON `property_events` (`property_id`);--> statement-breakpoint
CREATE INDEX `property_events_event_date_idx` ON `property_events` (`event_date`);