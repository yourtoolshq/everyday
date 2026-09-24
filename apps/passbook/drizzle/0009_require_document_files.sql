PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`period_key` text,
	`title` text NOT NULL,
	`document_date` text,
	`notes` text,
	`event_id` text,
	`terms_snapshot_id` text,
	`file_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `account_events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`terms_snapshot_id`) REFERENCES `account_terms_snapshots`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`file_id`) REFERENCES `yt_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_documents`("id", "account_id", "type", "period_key", "title", "document_date", "notes", "event_id", "terms_snapshot_id", "file_id", "original_filename", "storage_key", "mime_type", "size_bytes", "created_at", "updated_at") SELECT "id", "account_id", "type", "period_key", "title", "document_date", "notes", "event_id", "terms_snapshot_id", "file_id", "original_filename", "storage_key", "mime_type", "size_bytes", "created_at", "updated_at" FROM `documents`;--> statement-breakpoint
DROP TABLE `documents`;--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);--> statement-breakpoint
CREATE INDEX `documents_account_idx` ON `documents` (`account_id`);--> statement-breakpoint
CREATE INDEX `documents_event_idx` ON `documents` (`event_id`);--> statement-breakpoint
CREATE INDEX `documents_terms_snapshot_idx` ON `documents` (`terms_snapshot_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_file_unique` ON `documents` (`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_account_period_unique` ON `documents` (`account_id`,`period_key`);