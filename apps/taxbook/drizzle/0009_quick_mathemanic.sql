CREATE TABLE `business_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`tax_item_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `business_activities_year_idx` ON `business_activities` (`tax_year_id`);--> statement-breakpoint
CREATE INDEX `business_activities_person_idx` ON `business_activities` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `business_activities_tax_item_unique` ON `business_activities` (`tax_item_id`);--> statement-breakpoint
CREATE TABLE `business_record_attachments` (
	`business_record_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`business_record_id`) REFERENCES `business_records`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "business_record_attachment_size_valid" CHECK("business_record_attachments"."size_bytes" > 0 and "business_record_attachments"."size_bytes" <= 20971520)
);
--> statement-breakpoint
CREATE TABLE `business_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_activity_id` integer NOT NULL,
	`kind` text NOT NULL,
	`expense_category` text,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`business_activity_id`) REFERENCES `business_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "business_record_amount_positive" CHECK("business_records"."amount_cents" > 0),
	CONSTRAINT "business_record_category_consistent" CHECK(("business_records"."kind" = 'revenue' and "business_records"."expense_category" is null) or ("business_records"."kind" = 'expense' and "business_records"."expense_category" is not null))
);
--> statement-breakpoint
CREATE INDEX `business_records_activity_idx` ON `business_records` (`business_activity_id`);--> statement-breakpoint
CREATE INDEX `business_records_date_idx` ON `business_records` (`date`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tax_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`name` text NOT NULL,
	`tax_line_reference` text,
	`type` text NOT NULL,
	`owner_kind` text NOT NULL,
	`person_id` integer,
	`expected_amount_cents` integer,
	`actual_amount_cents` integer,
	`status` text NOT NULL,
	`value_source` text DEFAULT 'manual' NOT NULL,
	`tax_treatment` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tax_item_owner_consistent" CHECK(("__new_tax_items"."owner_kind" = 'household' and "__new_tax_items"."person_id" is null) or ("__new_tax_items"."owner_kind" = 'person' and "__new_tax_items"."person_id" is not null)),
	CONSTRAINT "tax_item_expected_non_negative" CHECK("__new_tax_items"."expected_amount_cents" is null or "__new_tax_items"."expected_amount_cents" >= 0),
	CONSTRAINT "tax_item_actual_non_negative" CHECK("__new_tax_items"."actual_amount_cents" is null or "__new_tax_items"."actual_amount_cents" >= 0 or "__new_tax_items"."value_source" = 'self_employment')
);
--> statement-breakpoint
INSERT INTO `__new_tax_items`("id", "tax_year_id", "name", "tax_line_reference", "type", "owner_kind", "person_id", "expected_amount_cents", "actual_amount_cents", "status", "value_source", "tax_treatment", "notes", "created_at", "updated_at") SELECT "id", "tax_year_id", "name", "tax_line_reference", "type", "owner_kind", "person_id", "expected_amount_cents", "actual_amount_cents", "status", "value_source", "tax_treatment", "notes", "created_at", "updated_at" FROM `tax_items`;--> statement-breakpoint
DROP TABLE `tax_items`;--> statement-breakpoint
ALTER TABLE `__new_tax_items` RENAME TO `tax_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tax_items_year_idx` ON `tax_items` (`tax_year_id`);--> statement-breakpoint
CREATE INDEX `tax_items_person_idx` ON `tax_items` (`person_id`);