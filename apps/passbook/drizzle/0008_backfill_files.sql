-- Existing documents keep their files in place: each gets a yt_files row with the same id and storage key.
INSERT INTO `yt_files` (`id`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, `endpoint`, `created_at`)
SELECT `id`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, 'document', `created_at`
FROM `documents`
WHERE `file_id` IS NULL;
--> statement-breakpoint
UPDATE `documents` SET `file_id` = `id` WHERE `file_id` IS NULL;
