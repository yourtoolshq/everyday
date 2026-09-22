CREATE TABLE `tax_estimate_person_inputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`full_time_study_months` integer DEFAULT 0 NOT NULL,
	`part_time_study_months` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tax_estimate_study_months" CHECK("tax_estimate_person_inputs"."full_time_study_months" >= 0 and "tax_estimate_person_inputs"."part_time_study_months" >= 0 and "tax_estimate_person_inputs"."full_time_study_months" + "tax_estimate_person_inputs"."part_time_study_months" <= 12)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_estimate_person_year_unique` ON `tax_estimate_person_inputs` (`tax_year_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `tax_estimate_person_idx` ON `tax_estimate_person_inputs` (`person_id`);--> statement-breakpoint
CREATE TABLE `tax_estimate_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`manitoba_credits_claimant_person_id` integer NOT NULL,
	`housing_mode` text DEFAULT 'none' NOT NULL,
	`home_ownership_start_date` text,
	`eligible_school_tax_cents` integer,
	`homeowner_advance_received_cents` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manitoba_credits_claimant_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tax_estimate_school_tax_non_negative" CHECK("tax_estimate_settings"."eligible_school_tax_cents" is null or "tax_estimate_settings"."eligible_school_tax_cents" >= 0),
	CONSTRAINT "tax_estimate_advance_non_negative" CHECK("tax_estimate_settings"."homeowner_advance_received_cents" is null or "tax_estimate_settings"."homeowner_advance_received_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_estimate_settings_year_unique` ON `tax_estimate_settings` (`tax_year_id`);--> statement-breakpoint
CREATE INDEX `tax_estimate_settings_claimant_idx` ON `tax_estimate_settings` (`manitoba_credits_claimant_person_id`);--> statement-breakpoint
ALTER TABLE `tax_items` ADD `tax_treatment` text;--> statement-breakpoint
UPDATE `tax_items` SET `tax_treatment` = 'employment_income' WHERE `value_source` = 'paycheques';
