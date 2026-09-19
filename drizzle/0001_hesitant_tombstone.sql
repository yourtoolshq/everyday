CREATE TABLE `discussions` (
	`id` text PRIMARY KEY NOT NULL,
	`employment_id` text NOT NULL,
	`title` text NOT NULL,
	`discussion_date` text,
	`participants` text,
	`body` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `discussions_employment_idx` ON `discussions` (`employment_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `discussion_id` text REFERENCES discussions(id);--> statement-breakpoint
CREATE INDEX `documents_discussion_idx` ON `documents` (`discussion_id`);