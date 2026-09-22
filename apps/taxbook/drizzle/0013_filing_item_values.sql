CREATE TABLE `filing_item_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filing_id` integer NOT NULL,
	`tax_item_id` integer,
	`item_name` text NOT NULL,
	`owner_label` text NOT NULL,
	`tax_line_reference` text,
	`amount_cents` integer NOT NULL,
	`difference_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`filing_id`) REFERENCES `filings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `filing_item_values_filing_idx` ON `filing_item_values` (`filing_id`);
