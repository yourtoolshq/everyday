CREATE TABLE `tax_document_attachments` (
	`tax_document_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_document_id`) REFERENCES `tax_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tax_document_attachment_size_valid" CHECK("tax_document_attachments"."size_bytes" > 0 and "tax_document_attachments"."size_bytes" <= 20971520)
);
--> statement-breakpoint
CREATE TABLE `tax_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_item_id` integer NOT NULL,
	`type` text NOT NULL,
	`custom_type_name` text,
	`issuer` text NOT NULL,
	`person_id` integer,
	`status` text DEFAULT 'expected' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tax_document_custom_type_consistent" CHECK(("tax_documents"."type" = 'other' and "tax_documents"."custom_type_name" is not null and length(trim("tax_documents"."custom_type_name")) > 0) or ("tax_documents"."type" <> 'other' and "tax_documents"."custom_type_name" is null))
);
--> statement-breakpoint
CREATE INDEX `tax_documents_tax_item_idx` ON `tax_documents` (`tax_item_id`);--> statement-breakpoint
CREATE INDEX `tax_documents_person_idx` ON `tax_documents` (`person_id`);--> statement-breakpoint
CREATE INDEX `tax_documents_status_idx` ON `tax_documents` (`status`);