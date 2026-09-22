CREATE TABLE `benefits` (
	`id` text PRIMARY KEY NOT NULL,
	`insurance_plan_id` text NOT NULL,
	`name` text NOT NULL,
	`coverage_scope` text NOT NULL,
	`person_id` text,
	`annual_limit_cents` integer NOT NULL,
	`opening_used_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`insurance_plan_id`) REFERENCES `insurance_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `benefits_insurance_plan_id_idx` ON `benefits` (`insurance_plan_id`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text NOT NULL,
	`benefit_id` text NOT NULL,
	`status` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`benefit_id`) REFERENCES `benefits`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `claims_visit_id_idx` ON `claims` (`visit_id`);--> statement-breakpoint
CREATE INDEX `claims_benefit_id_idx` ON `claims` (`benefit_id`);--> statement-breakpoint
CREATE INDEX `claims_status_idx` ON `claims` (`status`);--> statement-breakpoint
CREATE TABLE `insurance_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `visits` ADD `cost_cents` integer;