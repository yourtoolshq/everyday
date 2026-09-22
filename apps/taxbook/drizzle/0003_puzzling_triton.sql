CREATE TABLE `record_attachments` (
	`record_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "record_attachment_size_valid" CHECK("record_attachments"."size_bytes" > 0 and "record_attachments"."size_bytes" <= 20971520)
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_item_id` integer NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`person_id` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "record_amount_positive" CHECK("records"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `records_tax_item_idx` ON `records` (`tax_item_id`);--> statement-breakpoint
CREATE INDEX `records_person_idx` ON `records` (`person_id`);--> statement-breakpoint
CREATE INDEX `records_date_idx` ON `records` (`date`);
