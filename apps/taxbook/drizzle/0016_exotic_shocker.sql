ALTER TABLE `employments` ADD `tenure_employment_id` text;--> statement-breakpoint
ALTER TABLE `households` ADD `tenure_base_url` text DEFAULT 'http://localhost:3003' NOT NULL;--> statement-breakpoint
ALTER TABLE `households` ADD `tenure_last_sync_at` text;--> statement-breakpoint
ALTER TABLE `households` ADD `tenure_last_sync_error` text;--> statement-breakpoint
ALTER TABLE `paycheques` ADD `tenure_paycheck_id` text;--> statement-breakpoint
ALTER TABLE `paycheques` ADD `synced_from_tenure` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `paycheques_tenure_paycheck_unique` ON `paycheques` (`tenure_paycheck_id`);