ALTER TABLE `documents` ADD `event_id` text REFERENCES `account_events`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD `terms_snapshot_id` text REFERENCES `account_terms_snapshots`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `documents_event_idx` ON `documents` (`event_id`);--> statement-breakpoint
CREATE INDEX `documents_terms_snapshot_idx` ON `documents` (`terms_snapshot_id`);--> statement-breakpoint
INSERT INTO `documents` (
	`id`,
	`account_id`,
	`type`,
	`title`,
	`original_filename`,
	`storage_key`,
	`mime_type`,
	`size_bytes`,
	`event_id`,
	`created_at`,
	`updated_at`
)
SELECT
	`account_event_attachments`.`id`,
	`account_events`.`account_id`,
	'financial_correspondence',
	`account_event_attachments`.`title`,
	`account_event_attachments`.`original_filename`,
	`account_event_attachments`.`storage_key`,
	`account_event_attachments`.`mime_type`,
	`account_event_attachments`.`size_bytes`,
	`account_event_attachments`.`event_id`,
	`account_event_attachments`.`created_at`,
	`account_event_attachments`.`updated_at`
FROM `account_event_attachments`
INNER JOIN `account_events` ON `account_events`.`id` = `account_event_attachments`.`event_id`;--> statement-breakpoint
DROP TABLE `account_event_attachments`;
