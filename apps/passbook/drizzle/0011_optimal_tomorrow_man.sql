-- yt:reviewed-destructive
DROP INDEX `documents_storage_key_unique`;--> statement-breakpoint
ALTER TABLE `documents` DROP COLUMN `storage_key`;
