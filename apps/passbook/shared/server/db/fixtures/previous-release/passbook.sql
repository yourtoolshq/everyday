PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		);
INSERT INTO __drizzle_migrations VALUES(NULL,'8b280e18352dd5c8cb95c71ce9e1ff7e7b878d2d9a1a6dc9b449b0218331558a',1789689980612);
INSERT INTO __drizzle_migrations VALUES(NULL,'8fa48651c14a999c68b89b03413675fbf5dfb720ae9ced56624d383e36ef66f8',1789698264325);
INSERT INTO __drizzle_migrations VALUES(NULL,'1d681dad799b1016aaef83a88ead14c71f87366fe85959b93d11b43c4c551597',1789698756442);
INSERT INTO __drizzle_migrations VALUES(NULL,'9313f83b8deb0a48d8c251ba287c958c6c9332696acb7579fcfcff18f52bfc46',1789700857626);
INSERT INTO __drizzle_migrations VALUES(NULL,'bcf52cc37a75dcb1282afdbd0fb71d2aa038a58cf9a1ba44626f976e6b6e9cde',1789702000000);
INSERT INTO __drizzle_migrations VALUES(NULL,'881f22aef6d80d18c79f44ac1979a57bd1b73e2c6750800d6782bdae32b3d7c2',1789703000000);
INSERT INTO __drizzle_migrations VALUES(NULL,'11496576fb090332e748ac4c829c6b062a760cf1963bd6abc0c1e74645122ac9',1789757353294);
CREATE TABLE `account_ownership` (
	`account_id` text NOT NULL,
	`person_id` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO account_ownership VALUES('5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06','1c7a2d3e-8b4f-4a6c-9d0e-2f3a4b5c6d02');
INSERT INTO account_ownership VALUES('5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06','2d8b3e4f-9c5a-4b7d-8e1f-3a4b5c6d7e03');
INSERT INTO account_ownership VALUES('6bcf7c8d-3a9e-4fb0-8c5d-7e8f9a0b1c07','1c7a2d3e-8b4f-4a6c-9d0e-2f3a4b5c6d02');
INSERT INTO account_ownership VALUES('7cd08d9e-4baf-4ac1-9d6e-8f9a0b1c2d08','2d8b3e4f-9c5a-4b7d-8e1f-3a4b5c6d7e03');
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`display_name` text NOT NULL,
	`account_type` text NOT NULL,
	`identifier_suffix` text,
	`status` text DEFAULT 'active' NOT NULL,
	`opened_date` text,
	`closed_date` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `interest_rate` text, `promotional_interest_rate` text, `promotional_interest_rate_expires` text, `credit_limit` text, `annual_fee` text, `renewal_date` text, `insurance` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE restrict
);
INSERT INTO accounts VALUES('5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06','3e9c4f5a-0d6b-4c8e-9f2a-4b5c6d7e8f04','Everyday Chequing','chequing','4821','active','2023-06-01',NULL,NULL,'2024-11-02 18:30:00','2024-11-02 18:30:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO accounts VALUES('6bcf7c8d-3a9e-4fb0-8c5d-7e8f9a0b1c07','3e9c4f5a-0d6b-4c8e-9f2a-4b5c6d7e8f04','Rewards Visa','credit_card','0937','active','2023-09-15',NULL,NULL,'2024-11-02 18:32:00','2025-04-16 08:00:00','20.99',NULL,NULL,'8000','120','2025-09-15','Travel medical');
INSERT INTO accounts VALUES('7cd08d9e-4baf-4ac1-9d6e-8f9a0b1c2d08','4fad5a6b-1e7c-4d9f-8a3b-5c6d7e8f9a05','High Interest Savings','savings','5510','closed','2022-01-10','2024-12-31','Moved to Northwind','2024-11-02 18:35:00','2025-01-05 12:00:00','3.10','4.50','2024-06-30',NULL,NULL,NULL,NULL);
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`document_date` text,
	`notes` text,
	`original_filename` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `period_key` text, `event_id` text REFERENCES `account_events`(`id`) ON DELETE set null ON UPDATE no action, `terms_snapshot_id` text REFERENCES `account_terms_snapshots`(`id`) ON DELETE set null ON UPDATE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO documents VALUES('a0f3b0c1-7ed2-4df4-8a9b-1c2d3e4f5a11','5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06','statement','January 2025 statement','2025-01-31',NULL,'chequing-2025-01.pdf','5d0e2f7a-3b1c-4e8f-9a2d-6c7b8e9f0a11.pdf','application/pdf',92,'2025-02-03 20:00:00','2025-02-03 20:00:00','2025-01',NULL,NULL);
INSERT INTO documents VALUES('b104c1d2-8fe3-4e05-9bac-2d3e4f5a6b12','5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06','statement','March 2025 statement','2025-03-31',NULL,'chequing-2025-03.pdf','8a4c6e2b-9d1f-4a3e-b5c7-2e4f6a8b0c22.pdf','application/pdf',92,'2025-04-02 20:00:00','2025-04-02 20:00:00','2025-03',NULL,NULL);
INSERT INTO documents VALUES('c215d2e3-90f4-4f16-8cbd-3e4f5a6b7c13','5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06','void_cheque','Void cheque',NULL,'For payroll','void-cheque.png','c3e5a7b9-1d2f-4c6e-8a0b-4d6f8a0c2e33.png','image/png',69,'2024-11-03 10:00:00','2024-11-03 10:00:00',NULL,NULL,NULL);
INSERT INTO documents VALUES('d326e3f4-a105-4027-9dce-4f5a6b7c8d14','6bcf7c8d-3a9e-4fb0-8c5d-7e8f9a0b1c07','financial_correspondence','Credit limit notice','2025-04-15',NULL,'credit-limit.eml','e7b9d1f3-5a7c-4e0a-9c2e-6f8a0c2e4a44.eml','message/rfc822',263,'2025-04-16 08:05:00','2025-04-16 08:05:00',NULL,'9ef2afb0-6dc1-4ce3-9f8a-0b1c2d3e4f10','8de19eaf-5cb0-4bd2-8e7f-9a0b1c2d3e09');
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO households VALUES('0b6f1c2e-7a3d-4e5f-8a9b-1c2d3e4f5a01','Rivera household','2024-11-02 18:20:00','2024-11-02 18:20:00');
CREATE TABLE `institutions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO institutions VALUES('3e9c4f5a-0d6b-4c8e-9f2a-4b5c6d7e8f04','Northwind Bank','https://northwind.example',NULL,'2024-11-02 18:25:00','2024-11-02 18:25:00');
INSERT INTO institutions VALUES('4fad5a6b-1e7c-4d9f-8a3b-5c6d7e8f9a05','Maple Credit Union',NULL,'Branch on Queen St.','2024-11-02 18:26:00','2024-11-02 18:26:00');
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`display_name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO people VALUES('1c7a2d3e-8b4f-4a6c-9d0e-2f3a4b5c6d02','0b6f1c2e-7a3d-4e5f-8a9b-1c2d3e4f5a01','Alex Rivera',0,'2024-11-02 18:20:00','2024-11-02 18:20:00');
INSERT INTO people VALUES('2d8b3e4f-9c5a-4b7d-8e1f-3a4b5c6d7e03','0b6f1c2e-7a3d-4e5f-8a9b-1c2d3e4f5a01','Sam Rivera',1,'2024-11-02 18:20:00','2024-11-02 18:20:00');
CREATE TABLE `statement_expectations` (
	`account_id` text PRIMARY KEY NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO statement_expectations VALUES('5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06','monthly','2024-11-02 18:30:00','2024-11-02 18:30:00');
INSERT INTO statement_expectations VALUES('6bcf7c8d-3a9e-4fb0-8c5d-7e8f9a0b1c07','monthly','2024-11-02 18:32:00','2024-11-02 18:32:00');
INSERT INTO statement_expectations VALUES('7cd08d9e-4baf-4ac1-9d6e-8f9a0b1c2d08','quarterly','2024-11-02 18:35:00','2024-11-02 18:35:00');
CREATE TABLE `account_terms_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`effective_date` text NOT NULL,
	`interest_rate` text,
	`promotional_interest_rate` text,
	`promotional_interest_rate_expires` text,
	`credit_limit` text,
	`annual_fee` text,
	`renewal_date` text,
	`insurance` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO account_terms_snapshots VALUES('8de19eaf-5cb0-4bd2-8e7f-9a0b1c2d3e09','6bcf7c8d-3a9e-4fb0-8c5d-7e8f9a0b1c07','2025-05-01','20.99',NULL,NULL,'8000','120','2025-09-15','Travel medical','Limit increase','2025-04-16 08:00:00','2025-04-16 08:00:00');
CREATE TABLE `account_events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`start_date` text NOT NULL,
	`resolved_date` text,
	`terms_snapshot_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`terms_snapshot_id`) REFERENCES `account_terms_snapshots`(`id`) ON UPDATE no action ON DELETE set null
);
INSERT INTO account_events VALUES('9ef2afb0-6dc1-4ce3-9f8a-0b1c2d3e4f10','6bcf7c8d-3a9e-4fb0-8c5d-7e8f9a0b1c07','correspondence','Credit limit increase notice',NULL,'2025-04-15','2025-05-01','8de19eaf-5cb0-4bd2-8e7f-9a0b1c2d3e09','2025-04-16 08:00:00','2025-04-16 08:00:00');
CREATE TABLE `statement_period_exceptions` (
	`account_id` text NOT NULL,
	`period_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO statement_period_exceptions VALUES('5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06','2025-02','2025-03-10 19:00:00','2025-03-10 19:00:00');
CREATE UNIQUE INDEX `account_ownership_unique` ON `account_ownership` (`account_id`,`person_id`);
CREATE INDEX `account_ownership_person_idx` ON `account_ownership` (`person_id`);
CREATE INDEX `accounts_institution_idx` ON `accounts` (`institution_id`);
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);
CREATE INDEX `documents_account_idx` ON `documents` (`account_id`);
CREATE INDEX `people_household_idx` ON `people` (`household_id`);
CREATE UNIQUE INDEX `documents_account_period_unique` ON `documents` (`account_id`,`period_key`);
CREATE INDEX `account_terms_snapshots_account_idx` ON `account_terms_snapshots` (`account_id`);
CREATE INDEX `account_events_account_idx` ON `account_events` (`account_id`);
CREATE INDEX `documents_event_idx` ON `documents` (`event_id`);
CREATE INDEX `documents_terms_snapshot_idx` ON `documents` (`terms_snapshot_id`);
CREATE UNIQUE INDEX `statement_period_exceptions_unique` ON `statement_period_exceptions` (`account_id`,`period_key`);
CREATE INDEX `statement_period_exceptions_account_idx` ON `statement_period_exceptions` (`account_id`);
COMMIT;
