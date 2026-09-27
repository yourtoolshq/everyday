PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		);
INSERT INTO __drizzle_migrations VALUES(NULL,'33396c11492f1e08f6951590c83ea78c51d1b567a0136876590d50925b8e361c',1789827922462);
INSERT INTO __drizzle_migrations VALUES(NULL,'de80209f9871fddae6302284fa25f82e55be7fd30b97ef773323f44eb02e59b1',1789830331930);
INSERT INTO __drizzle_migrations VALUES(NULL,'53e0d7d7596fc62c1b7d3804ec6e765bba2c50bf8d8f97a5170c5b1d23dfb153',1789832158817);
INSERT INTO __drizzle_migrations VALUES(NULL,'96e08f6ee8e29faf2318c47bee4888a89a4c1b9ac68b35e1666f5f2b114fe02d',1789834773408);
INSERT INTO __drizzle_migrations VALUES(NULL,'d54bb39676c681c356ba78865e089755afa48ec28e0baaeba98896a186e070a1',1789836333709);
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`employment_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`document_date` text,
	`notes` text,
	`original_filename` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `discussion_id` text REFERENCES discussions(id),
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO documents VALUES('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','contract','Employment agreement','2024-01-15',NULL,'agreement.pdf','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf','application/pdf',8,'2024-01-15 12:00:00','2024-06-01 12:00:00',NULL);
INSERT INTO documents VALUES('66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','pay_stub','Jan 31 2024 Northwind Labs Alex Chen Pay stub','2024-01-31',NULL,'stub.pdf','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf','application/pdf',8,'2024-02-01 12:00:00','2024-06-01 12:00:00',NULL);
INSERT INTO documents VALUES('77777777-7777-4777-8777-777777777777','44444444-4444-4444-8444-444444444444','salary_letter','Salary letter','2024-06-01',NULL,'salary.eml','cccccccc-cccc-4ccc-8ccc-cccccccccccc.eml','message/rfc822',120,'2024-06-01 12:00:00','2024-06-01 12:00:00',NULL);
CREATE TABLE `employers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO employers VALUES('33333333-3333-4333-8333-333333333333','Northwind Labs',NULL,NULL,'2024-06-01 12:00:00','2024-06-01 12:00:00');
CREATE TABLE `employments` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`person_id` text NOT NULL,
	`job_title` text,
	`status` text DEFAULT 'current' NOT NULL,
	`start_date` text,
	`end_date` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `pay_frequency` text DEFAULT 'irregular' NOT NULL, `biweekly_anchor_date` text, `deduction_settings` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO employments VALUES('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Analyst','current','2024-01-15',NULL,NULL,'2024-06-01 12:00:00','2024-06-01 12:00:00','biweekly',NULL,'{}');
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO households VALUES('11111111-1111-4111-8111-111111111111','Chen household','2024-06-01 12:00:00','2024-06-01 12:00:00');
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`display_name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO people VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Alex Chen',0,'2024-06-01 12:00:00','2024-06-01 12:00:00');
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
CREATE TABLE `pay_period_exceptions` (
	`employment_id` text NOT NULL,
	`period_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`employment_id`, `period_key`),
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `paychecks` (
	`id` text PRIMARY KEY NOT NULL,
	`employment_id` text NOT NULL,
	`pay_date` text NOT NULL,
	`period_start_date` text NOT NULL,
	`period_end_date` text NOT NULL,
	`gross_pay_cents` integer NOT NULL,
	`income_tax_cents` integer NOT NULL,
	`federal_income_tax_cents` integer DEFAULT 0 NOT NULL,
	`manitoba_income_tax_cents` integer DEFAULT 0 NOT NULL,
	`cpp_cents` integer NOT NULL,
	`cpp2_cents` integer NOT NULL,
	`ei_cents` integer NOT NULL,
	`wi_cents` integer DEFAULT 0 NOT NULL,
	`ltd_cents` integer DEFAULT 0 NOT NULL,
	`extended_health_cents` integer DEFAULT 0 NOT NULL,
	`travel_medical_cents` integer DEFAULT 0 NOT NULL,
	`union_dues_cents` integer DEFAULT 0 NOT NULL,
	`other_deductions_cents` integer NOT NULL,
	`net_pay_cents` integer NOT NULL,
	`document_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null
);
INSERT INTO paychecks VALUES('88888888-8888-4888-8888-888888888888','44444444-4444-4444-8444-444444444444','2024-01-31','2024-01-15','2024-01-26',200000,40000,0,0,10000,0,3000,0,0,0,0,0,0,147000,'66666666-6666-4666-8666-666666666666','2024-06-01 12:00:00','2024-06-01 12:00:00');
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
INSERT INTO compensation_changes VALUES('99999999-9999-4999-8999-999999999999','44444444-4444-4444-8444-444444444444','annual_salary','CAD','2024-06-01',9000000,NULL,NULL,'77777777-7777-4777-8777-777777777777',NULL,'2024-06-01 12:00:00','2024-06-01 12:00:00');
CREATE TABLE `employment_record_exceptions` (
	`employment_id` text NOT NULL,
	`requirement_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`employment_id`, `requirement_key`),
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);
CREATE INDEX `documents_employment_idx` ON `documents` (`employment_id`);
CREATE INDEX `employments_employer_idx` ON `employments` (`employer_id`);
CREATE INDEX `employments_person_idx` ON `employments` (`person_id`);
CREATE INDEX `people_household_idx` ON `people` (`household_id`);
CREATE INDEX `discussions_employment_idx` ON `discussions` (`employment_id`);
CREATE INDEX `documents_discussion_idx` ON `documents` (`discussion_id`);
CREATE INDEX `pay_period_exceptions_employment_idx` ON `pay_period_exceptions` (`employment_id`);
CREATE INDEX `paychecks_employment_idx` ON `paychecks` (`employment_id`);
CREATE INDEX `paychecks_document_idx` ON `paychecks` (`document_id`);
CREATE INDEX `compensation_changes_employment_idx` ON `compensation_changes` (`employment_id`);
CREATE INDEX `compensation_changes_document_idx` ON `compensation_changes` (`document_id`);
CREATE INDEX `compensation_changes_discussion_idx` ON `compensation_changes` (`discussion_id`);
CREATE INDEX `employment_record_exceptions_employment_idx` ON `employment_record_exceptions` (`employment_id`);
COMMIT;
