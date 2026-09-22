CREATE TABLE `pay_period_exceptions` (
	`employment_id` text NOT NULL,
	`period_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`employment_id`, `period_key`),
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pay_period_exceptions_employment_idx` ON `pay_period_exceptions` (`employment_id`);--> statement-breakpoint
CREATE TABLE `paychecks` (
	`id` text PRIMARY KEY NOT NULL,
	`employment_id` text NOT NULL,
	`pay_date` text NOT NULL,
	`period_start_date` text NOT NULL,
	`period_end_date` text NOT NULL,
	`gross_pay_cents` integer NOT NULL,
	`income_tax_cents` integer NOT NULL,
	`federal_income_tax_cents` integer DEFAULT 0 NOT NULL,
	`manitoba_income_tax_cents` integer DEFAULT 0 NOT NULL,
	`cpp_cents` integer NOT NULL,
	`cpp2_cents` integer NOT NULL,
	`ei_cents` integer NOT NULL,
	`wi_cents` integer DEFAULT 0 NOT NULL,
	`ltd_cents` integer DEFAULT 0 NOT NULL,
	`extended_health_cents` integer DEFAULT 0 NOT NULL,
	`travel_medical_cents` integer DEFAULT 0 NOT NULL,
	`union_dues_cents` integer DEFAULT 0 NOT NULL,
	`other_deductions_cents` integer NOT NULL,
	`net_pay_cents` integer NOT NULL,
	`document_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `paychecks_employment_idx` ON `paychecks` (`employment_id`);--> statement-breakpoint
CREATE INDEX `paychecks_document_idx` ON `paychecks` (`document_id`);--> statement-breakpoint
ALTER TABLE `employments` ADD `pay_frequency` text DEFAULT 'irregular' NOT NULL;--> statement-breakpoint
ALTER TABLE `employments` ADD `biweekly_anchor_date` text;--> statement-breakpoint
ALTER TABLE `employments` ADD `deduction_settings` text DEFAULT '{}' NOT NULL;