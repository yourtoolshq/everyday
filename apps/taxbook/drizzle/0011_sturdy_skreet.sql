CREATE TABLE `filing_affected_tax_items` (
	`filing_id` integer NOT NULL,
	`tax_item_id` integer NOT NULL,
	PRIMARY KEY(`filing_id`, `tax_item_id`),
	FOREIGN KEY (`filing_id`) REFERENCES `filings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE restrict
);
