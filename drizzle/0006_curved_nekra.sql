CREATE TABLE `statement_period_exceptions` (
	`account_id` text NOT NULL,
	`period_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statement_period_exceptions_unique` ON `statement_period_exceptions` (`account_id`,`period_key`);--> statement-breakpoint
CREATE INDEX `statement_period_exceptions_account_idx` ON `statement_period_exceptions` (`account_id`);
