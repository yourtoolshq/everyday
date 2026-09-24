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
CREATE UNIQUE INDEX `yt_files_storage_key_unique` ON `yt_files` (`storage_key`);--> statement-breakpoint
ALTER TABLE `documents` ADD `file_id` text REFERENCES yt_files(id);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_file_unique` ON `documents` (`file_id`);