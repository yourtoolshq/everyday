CREATE TABLE `employments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`tax_item_id` integer NOT NULL,
	`employer_name` text NOT NULL,
	`pay_frequency` text NOT NULL,
	`status` text NOT NULL,
	`end_date` text,
	`typical_gross_override_cents` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "employment_status_end_date_consistent" CHECK(("employments"."status" = 'active' and "employments"."end_date" is null) or ("employments"."status" = 'ended' and "employments"."end_date" is not null)),
	CONSTRAINT "employment_typical_gross_non_negative" CHECK("employments"."typical_gross_override_cents" is null or "employments"."typical_gross_override_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `employments_year_idx` ON `employments` (`tax_year_id`);--> statement-breakpoint
CREATE INDEX `employments_person_idx` ON `employments` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `employments_tax_item_unique` ON `employments` (`tax_item_id`);--> statement-breakpoint
CREATE TABLE `paycheques` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employment_id` integer NOT NULL,
	`pay_date` text NOT NULL,
	`gross_pay_cents` integer NOT NULL,
	`income_tax_cents` integer NOT NULL,
	`cpp_cents` integer NOT NULL,
	`cpp2_cents` integer NOT NULL,
	`ei_cents` integer NOT NULL,
	`other_deductions_cents` integer NOT NULL,
	`net_pay_cents` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "paycheque_amounts_non_negative" CHECK("paycheques"."gross_pay_cents" >= 0 and "paycheques"."income_tax_cents" >= 0 and "paycheques"."cpp_cents" >= 0 and "paycheques"."cpp2_cents" >= 0 and "paycheques"."ei_cents" >= 0 and "paycheques"."other_deductions_cents" >= 0 and "paycheques"."net_pay_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `paycheques_employment_idx` ON `paycheques` (`employment_id`);--> statement-breakpoint
CREATE INDEX `paycheques_date_idx` ON `paycheques` (`pay_date`);--> statement-breakpoint
ALTER TABLE `tax_items` ADD `value_source` text DEFAULT 'manual' NOT NULL;