CREATE TABLE `care_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`person_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`cadence` text NOT NULL,
	`interval_count` integer,
	`interval_unit` text,
	`timing_kind` text NOT NULL,
	`target_date` text,
	`date_meaning` text,
	`target_month` integer,
	`target_season` text,
	`source` text NOT NULL,
	`source_detail` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `care_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `care_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_plans_year_unique` ON `care_plans` (`year`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
