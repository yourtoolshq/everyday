PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		);
INSERT INTO __drizzle_migrations VALUES(NULL,'80e5df973867933ab8c71ce602da754bf908ca5b3f3479bfb748858228883428',1789530045938);
INSERT INTO __drizzle_migrations VALUES(NULL,'e1f1a4a69f11a628ad0e9489d81ec2cbc331a378d3229e0f6786ca5f76dabb56',1789561700354);
INSERT INTO __drizzle_migrations VALUES(NULL,'2b4e8b1a2f887fadae0d2070cd98e322c064cf5f790a4b772c7fae1ce2b5966c',1789591804453);
INSERT INTO __drizzle_migrations VALUES(NULL,'7643a2870e16d0fe6728fea6be007180ec47e63074278681086eb04503515ee9',1789651067379);
INSERT INTO __drizzle_migrations VALUES(NULL,'323471420d11a41c39efa1680b38848e049dd2c84b6f622053acfdb18eead17e',1789653096011);
CREATE TABLE `care_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`person_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
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
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `target_visit_count` integer DEFAULT 1 NOT NULL, `not_pursuing_at` text,
	FOREIGN KEY (`plan_id`) REFERENCES `care_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict
);
CREATE TABLE `care_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO people VALUES('11111111-1111-4111-8111-111111111111','Jordan Hale','2026-09-27 13:11:45','2026-09-27 13:11:45');
CREATE TABLE `care_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone_numbers` text DEFAULT '[]' NOT NULL,
	`website_url` text,
	`booking_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`care_organization_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`care_organization_id`) REFERENCES `care_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`care_item_id` text,
	`provider_id` text,
	`care_organization_id` text,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`status` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `cost_cents` integer,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`care_item_id`) REFERENCES `care_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`care_organization_id`) REFERENCES `care_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
INSERT INTO visits VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',NULL,NULL,NULL,'Annual checkup','2026-03-12T15:00:00.000Z','completed',NULL,'2026-09-27 13:11:45','2026-09-27 13:11:45',NULL);
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`original_filename` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `claim_id` text REFERENCES claims(id),
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO documents VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','receipt','Visit receipt','receipt.pdf','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf','application/pdf',27,'2026-03-12 15:00:00','2026-09-27 13:11:45',NULL);
INSERT INTO documents VALUES('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','report','Lab image','result.jpg','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg','image/jpeg',4,'2026-03-12 15:00:00','2026-09-27 13:11:45',NULL);
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
CREATE TABLE `insurance_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `care_plans_year_unique` ON `care_plans` (`year`);
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);
CREATE INDEX `benefits_insurance_plan_id_idx` ON `benefits` (`insurance_plan_id`);
CREATE INDEX `claims_visit_id_idx` ON `claims` (`visit_id`);
CREATE INDEX `claims_benefit_id_idx` ON `claims` (`benefit_id`);
CREATE INDEX `claims_status_idx` ON `claims` (`status`);
COMMIT;
