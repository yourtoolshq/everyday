CREATE TABLE `households` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `people_household_idx` ON `people` (`household_id`);--> statement-breakpoint
CREATE TABLE `tax_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`owner_kind` text NOT NULL,
	`person_id` integer,
	`expected_amount_cents` integer,
	`actual_amount_cents` integer,
	`status` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tax_item_owner_consistent" CHECK(("tax_items"."owner_kind" = 'household' and "tax_items"."person_id" is null) or ("tax_items"."owner_kind" = 'person' and "tax_items"."person_id" is not null)),
	CONSTRAINT "tax_item_expected_non_negative" CHECK("tax_items"."expected_amount_cents" is null or "tax_items"."expected_amount_cents" >= 0),
	CONSTRAINT "tax_item_actual_non_negative" CHECK("tax_items"."actual_amount_cents" is null or "tax_items"."actual_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `tax_items_year_idx` ON `tax_items` (`tax_year_id`);--> statement-breakpoint
CREATE INDEX `tax_items_person_idx` ON `tax_items` (`person_id`);--> statement-breakpoint
CREATE TABLE `tax_years` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`year` integer NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tax_year_range" CHECK("tax_years"."year" between 2000 and 2100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_year_household_year_unique` ON `tax_years` (`household_id`,`year`);--> statement-breakpoint
CREATE UNIQUE INDEX `tax_year_one_active_unique` ON `tax_years` (`household_id`) WHERE "tax_years"."is_active" = 1;