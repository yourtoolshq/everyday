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
-- Existing visit documents keep their files in place: each gets a yt_files row with the same id and storage key.
INSERT INTO `yt_files` (`id`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, `endpoint`, `created_at`)
SELECT `id`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, 'document', `created_at`
FROM `documents`;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text NOT NULL,
	`claim_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`file_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`file_id`) REFERENCES `yt_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_documents`("id", "visit_id", "claim_id", "type", "title", "file_id", "original_filename", "mime_type", "size_bytes", "created_at", "updated_at") SELECT "id", "visit_id", "claim_id", "type", "title", "id", "original_filename", "mime_type", "size_bytes", "created_at", "updated_at" FROM `documents`;
--> statement-breakpoint
DROP TABLE `documents`;
--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_file_unique` ON `documents` (`file_id`);
