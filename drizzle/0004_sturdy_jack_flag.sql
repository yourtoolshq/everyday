CREATE TABLE `employment_record_exceptions` (
	`employment_id` text NOT NULL,
	`requirement_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`employment_id`, `requirement_key`),
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `employment_record_exceptions_employment_idx` ON `employment_record_exceptions` (`employment_id`);