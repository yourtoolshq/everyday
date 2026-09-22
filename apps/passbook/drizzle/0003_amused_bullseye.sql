CREATE TABLE `account_terms_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`effective_date` text NOT NULL,
	`interest_rate` text,
	`promotional_interest_rate` text,
	`promotional_interest_rate_expires` text,
	`credit_limit` text,
	`annual_fee` text,
	`renewal_date` text,
	`insurance` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_terms_snapshots_account_idx` ON `account_terms_snapshots` (`account_id`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `interest_rate` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `promotional_interest_rate` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `promotional_interest_rate_expires` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `credit_limit` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `annual_fee` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `renewal_date` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `insurance` text;