ALTER TABLE `documents` ADD `period_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `documents_account_period_unique` ON `documents` (`account_id`,`period_key`);