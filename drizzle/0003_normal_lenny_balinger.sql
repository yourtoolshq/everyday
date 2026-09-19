CREATE TABLE `compensation_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`employment_id` text NOT NULL,
	`type` text NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`effective_date` text NOT NULL,
	`amount_cents` integer,
	`commission_basis_points` integer,
	`notes` text,
	`document_id` text,
	`discussion_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`discussion_id`) REFERENCES `discussions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `compensation_changes_employment_idx` ON `compensation_changes` (`employment_id`);--> statement-breakpoint
CREATE INDEX `compensation_changes_document_idx` ON `compensation_changes` (`document_id`);--> statement-breakpoint
CREATE INDEX `compensation_changes_discussion_idx` ON `compensation_changes` (`discussion_id`);