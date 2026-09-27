-- yt:reviewed-destructive
CREATE TABLE `yt_files` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text,
	`endpoint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `yt_files_storage_key_unique` ON `yt_files` (`storage_key`);
--> statement-breakpoint
CREATE TABLE `yt_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
-- Existing documents keep their files in place: each gets a yt_files row with the same id and storage key.
INSERT INTO `yt_files` (`id`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, `endpoint`, `created_at`)
SELECT `id`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, 'document', `created_at`
FROM `documents`;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`employment_id` text NOT NULL,
	`discussion_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`document_date` text,
	`notes` text,
	`file_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`discussion_id`) REFERENCES `discussions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`file_id`) REFERENCES `yt_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_documents`("id", "employment_id", "discussion_id", "type", "title", "document_date", "notes", "file_id", "original_filename", "mime_type", "size_bytes", "created_at", "updated_at") SELECT "id", "employment_id", "discussion_id", "type", "title", "document_date", "notes", "id", "original_filename", "mime_type", "size_bytes", "created_at", "updated_at" FROM `documents`;
--> statement-breakpoint
DROP TABLE `documents`;
--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE INDEX `documents_employment_idx` ON `documents` (`employment_id`);
--> statement-breakpoint
CREATE INDEX `documents_discussion_idx` ON `documents` (`discussion_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_file_unique` ON `documents` (`file_id`);
