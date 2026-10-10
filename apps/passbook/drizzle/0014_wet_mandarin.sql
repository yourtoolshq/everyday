CREATE TABLE `investment_entry_drafts` (
	`document_id` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`command` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `investment_entry_preferences` (
	`account_id` text PRIMARY KEY NOT NULL,
	`preferences` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
