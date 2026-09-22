CREATE TABLE `assessment_attachments` (
	`assessment_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "assessment_attachment_size_valid" CHECK("assessment_attachments"."size_bytes" > 0 and "assessment_attachments"."size_bytes" <= 20971520)
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filing_id` integer NOT NULL,
	`kind` text NOT NULL,
	`assessment_date` text NOT NULL,
	`assessed_result_cents` integer,
	`refund_or_payment_date` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`filing_id`) REFERENCES `filings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessments_filing_unique` ON `assessments` (`filing_id`);--> statement-breakpoint
CREATE INDEX `assessments_date_idx` ON `assessments` (`assessment_date`);--> statement-breakpoint
CREATE TABLE `filing_attachments` (
	`filing_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`filing_id`) REFERENCES `filings`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "filing_attachment_size_valid" CHECK("filing_attachments"."size_bytes" > 0 and "filing_attachments"."size_bytes" <= 20971520)
);
--> statement-breakpoint
CREATE TABLE `filings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'preparing' NOT NULL,
	`submission_date` text,
	`expected_result_cents` integer,
	`return_copy_status` text DEFAULT 'not_added_yet' NOT NULL,
	`reason` text,
	`expected_change_cents` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "filing_reason_consistent" CHECK(("filings"."kind" = 'adjustment' and "filings"."reason" is not null and length(trim("filings"."reason")) > 0) or ("filings"."kind" = 'original_return' and "filings"."reason" is null and "filings"."expected_change_cents" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `filings_original_return_unique` ON `filings` (`tax_year_id`,`person_id`) WHERE "filings"."kind" = 'original_return';--> statement-breakpoint
CREATE INDEX `filings_year_person_idx` ON `filings` (`tax_year_id`,`person_id`,`submission_date`);--> statement-breakpoint
ALTER TABLE `tax_years` ADD `status` text DEFAULT 'tracking' NOT NULL;