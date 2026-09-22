PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tax_estimate_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`manitoba_credits_claimant_person_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manitoba_credits_claimant_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_tax_estimate_settings`("id", "tax_year_id", "manitoba_credits_claimant_person_id", "created_at", "updated_at") SELECT "id", "tax_year_id", "manitoba_credits_claimant_person_id", "created_at", "updated_at" FROM `tax_estimate_settings`;--> statement-breakpoint
DROP TABLE `tax_estimate_settings`;--> statement-breakpoint
ALTER TABLE `__new_tax_estimate_settings` RENAME TO `tax_estimate_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tax_estimate_settings_year_unique` ON `tax_estimate_settings` (`tax_year_id`);--> statement-breakpoint
CREATE INDEX `tax_estimate_settings_claimant_idx` ON `tax_estimate_settings` (`manitoba_credits_claimant_person_id`);