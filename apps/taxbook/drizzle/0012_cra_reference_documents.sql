CREATE TABLE `cra_reference_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`person_id` integer,
	`document_date` text,
	`reporting_period_label` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `cra_reference_documents_year_idx` ON `cra_reference_documents` (`tax_year_id`);--> statement-breakpoint
CREATE INDEX `cra_reference_documents_person_idx` ON `cra_reference_documents` (`person_id`);--> statement-breakpoint
CREATE TABLE `cra_reference_document_attachments` (
	`cra_reference_document_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cra_reference_document_id`) REFERENCES `cra_reference_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cra_reference_document_attachment_size_valid" CHECK("cra_reference_document_attachments"."size_bytes" > 0 and "cra_reference_document_attachments"."size_bytes" <= 20971520)
);
