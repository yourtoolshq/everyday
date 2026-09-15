PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_paycheques` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employment_id` integer NOT NULL,
	`pay_date` text NOT NULL,
	`gross_pay_cents` integer NOT NULL,
	`income_tax_cents` integer NOT NULL,
	`cpp_cents` integer NOT NULL,
	`cpp2_cents` integer NOT NULL,
	`ei_cents` integer NOT NULL,
	`wi_cents` integer DEFAULT 0 NOT NULL,
	`ltd_cents` integer DEFAULT 0 NOT NULL,
	`other_deductions_cents` integer NOT NULL,
	`net_pay_cents` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "paycheque_amounts_non_negative" CHECK("__new_paycheques"."gross_pay_cents" >= 0 and "__new_paycheques"."income_tax_cents" >= 0 and "__new_paycheques"."cpp_cents" >= 0 and "__new_paycheques"."cpp2_cents" >= 0 and "__new_paycheques"."ei_cents" >= 0 and "__new_paycheques"."wi_cents" >= 0 and "__new_paycheques"."ltd_cents" >= 0 and "__new_paycheques"."other_deductions_cents" >= 0 and "__new_paycheques"."net_pay_cents" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_paycheques`("id", "employment_id", "pay_date", "gross_pay_cents", "income_tax_cents", "cpp_cents", "cpp2_cents", "ei_cents", "wi_cents", "ltd_cents", "other_deductions_cents", "net_pay_cents", "created_at", "updated_at") SELECT "id", "employment_id", "pay_date", "gross_pay_cents", "income_tax_cents", "cpp_cents", "cpp2_cents", "ei_cents", 0, 0, "other_deductions_cents", "net_pay_cents", "created_at", "updated_at" FROM `paycheques`;--> statement-breakpoint
DROP TABLE `paycheques`;--> statement-breakpoint
ALTER TABLE `__new_paycheques` RENAME TO `paycheques`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `paycheques_employment_idx` ON `paycheques` (`employment_id`);--> statement-breakpoint
CREATE INDEX `paycheques_date_idx` ON `paycheques` (`pay_date`);--> statement-breakpoint
ALTER TABLE `employments` ADD `income_tax_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `employments` ADD `cpp_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `employments` ADD `cpp2_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `employments` ADD `ei_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `employments` ADD `wi_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `employments` ADD `ltd_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `employments` ADD `other_deductions_enabled` integer DEFAULT true NOT NULL;
