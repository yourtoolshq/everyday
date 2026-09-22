CREATE TABLE `statement_expectations` (
	`account_id` text PRIMARY KEY NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `statement_expectations` (`account_id`, `frequency`)
SELECT `id`, 'monthly' FROM `accounts`;
