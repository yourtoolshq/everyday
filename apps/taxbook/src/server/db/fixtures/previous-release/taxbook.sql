PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE `households` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
, `tenure_base_url` text DEFAULT 'http://localhost:3003' NOT NULL, `tenure_last_sync_at` text, `tenure_last_sync_error` text, `tenure_person_mappings` text DEFAULT '{}' NOT NULL);
INSERT INTO households VALUES(1,'Example household',1790515526,1790515526,'http://localhost:3003',NULL,NULL,'{}');
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO people VALUES(1,1,'Person A',0,1790515526,1790515526);
CREATE TABLE `tax_years` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`year` integer NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL, `status` text DEFAULT 'tracking' NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tax_year_range" CHECK("tax_years"."year" between 2000 and 2100)
);
INSERT INTO tax_years VALUES(1,1,2026,1,1790515526,1790515526,'tracking');
CREATE TABLE `employments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`tax_item_id` integer NOT NULL,
	`employer_name` text NOT NULL,
	`pay_frequency` text NOT NULL,
	`status` text NOT NULL,
	`end_date` text,
	`typical_gross_override_cents` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL, `income_tax_enabled` integer DEFAULT true NOT NULL, `cpp_enabled` integer DEFAULT true NOT NULL, `cpp2_enabled` integer DEFAULT true NOT NULL, `ei_enabled` integer DEFAULT true NOT NULL, `wi_enabled` integer DEFAULT false NOT NULL, `ltd_enabled` integer DEFAULT false NOT NULL, `other_deductions_enabled` integer DEFAULT true NOT NULL, `extended_health_enabled` integer DEFAULT false NOT NULL, `travel_medical_enabled` integer DEFAULT false NOT NULL, `union_dues_enabled` integer DEFAULT false NOT NULL, `phsp_reported_on_t4` integer DEFAULT false NOT NULL, `union_dues_reported_on_t4` integer DEFAULT false NOT NULL, `phsp_tax_item_id` integer REFERENCES tax_items(id), `union_dues_tax_item_id` integer REFERENCES tax_items(id), `federal_income_tax_enabled` integer DEFAULT false NOT NULL, `manitoba_income_tax_enabled` integer DEFAULT false NOT NULL, `deduction_field_order` text, `tenure_employment_id` text,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "employment_status_end_date_consistent" CHECK(("employments"."status" = 'active' and "employments"."end_date" is null) or ("employments"."status" = 'ended' and "employments"."end_date" is not null)),
	CONSTRAINT "employment_typical_gross_non_negative" CHECK("employments"."typical_gross_override_cents" is null or "employments"."typical_gross_override_cents" >= 0)
);
CREATE TABLE `record_attachments` (
	`record_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "record_attachment_size_valid" CHECK("record_attachments"."size_bytes" > 0 and "record_attachments"."size_bytes" <= 20971520)
);
INSERT INTO record_attachments VALUES(1,'fictional-receipt.pdf','application/pdf',42,X'255044462d312e340a66696374696f6e616c206669787475726520646f63756d656e740a2525454f460a',1790515526,1790515526);
CREATE TABLE `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_item_id` integer NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`person_id` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "record_amount_positive" CHECK("records"."amount_cents" > 0)
);
INSERT INTO records VALUES(1,1,'2026-03-12','Fictional clinic receipt',1250,1,'Previous-release fixture',1790515526,1790515526);
CREATE TABLE `tax_document_attachments` (
	`tax_document_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_document_id`) REFERENCES `tax_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tax_document_attachment_size_valid" CHECK("tax_document_attachments"."size_bytes" > 0 and "tax_document_attachments"."size_bytes" <= 20971520)
);
CREATE TABLE `tax_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_item_id` integer NOT NULL,
	`type` text NOT NULL,
	`custom_type_name` text,
	`issuer` text NOT NULL,
	`person_id` integer,
	`status` text DEFAULT 'expected' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tax_document_custom_type_consistent" CHECK(("tax_documents"."type" = 'other' and "tax_documents"."custom_type_name" is not null and length(trim("tax_documents"."custom_type_name")) > 0) or ("tax_documents"."type" <> 'other' and "tax_documents"."custom_type_name" is null))
);
CREATE TABLE `business_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`tax_item_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `business_record_attachments` (
	`business_record_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`business_record_id`) REFERENCES `business_records`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "business_record_attachment_size_valid" CHECK("business_record_attachments"."size_bytes" > 0 and "business_record_attachments"."size_bytes" <= 20971520)
);
CREATE TABLE `business_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_activity_id` integer NOT NULL,
	`kind` text NOT NULL,
	`expense_category` text,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`business_activity_id`) REFERENCES `business_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "business_record_amount_positive" CHECK("business_records"."amount_cents" > 0),
	CONSTRAINT "business_record_category_consistent" CHECK(("business_records"."kind" = 'revenue' and "business_records"."expense_category" is null) or ("business_records"."kind" = 'expense' and "business_records"."expense_category" is not null))
);
CREATE TABLE IF NOT EXISTS "tax_items" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`name` text NOT NULL,
	`tax_line_reference` text,
	`type` text NOT NULL,
	`owner_kind` text NOT NULL,
	`person_id` integer,
	`expected_amount_cents` integer,
	`actual_amount_cents` integer,
	`status` text NOT NULL,
	`value_source` text DEFAULT 'manual' NOT NULL,
	`tax_treatment` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tax_item_owner_consistent" CHECK(("tax_items"."owner_kind" = 'household' and "tax_items"."person_id" is null) or ("tax_items"."owner_kind" = 'person' and "tax_items"."person_id" is not null)),
	CONSTRAINT "tax_item_expected_non_negative" CHECK("tax_items"."expected_amount_cents" is null or "tax_items"."expected_amount_cents" >= 0),
	CONSTRAINT "tax_item_actual_non_negative" CHECK("tax_items"."actual_amount_cents" is null or "tax_items"."actual_amount_cents" >= 0 or "tax_items"."value_source" = 'self_employment')
);
INSERT INTO tax_items VALUES(1,1,'Example expense',NULL,'eligible_expense','household',NULL,NULL,1250,'in_progress','records',NULL,NULL,1790515526,1790515526);
CREATE TABLE `assessment_attachments` (
	`assessment_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "assessment_attachment_size_valid" CHECK("assessment_attachments"."size_bytes" > 0 and "assessment_attachments"."size_bytes" <= 20971520)
);
CREATE TABLE `assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filing_id` integer NOT NULL,
	`kind` text NOT NULL,
	`assessment_date` text NOT NULL,
	`assessed_result_cents` integer,
	`refund_or_payment_date` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`filing_id`) REFERENCES `filings`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `filing_attachments` (
	`filing_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`filing_id`) REFERENCES `filings`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "filing_attachment_size_valid" CHECK("filing_attachments"."size_bytes" > 0 and "filing_attachments"."size_bytes" <= 20971520)
);
CREATE TABLE `filings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'preparing' NOT NULL,
	`submission_date` text,
	`expected_result_cents` integer,
	`return_copy_status` text DEFAULT 'not_added_yet' NOT NULL,
	`reason` text,
	`expected_change_cents` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "filing_reason_consistent" CHECK(("filings"."kind" = 'adjustment' and "filings"."reason" is not null and length(trim("filings"."reason")) > 0) or ("filings"."kind" = 'original_return' and "filings"."reason" is null and "filings"."expected_change_cents" is null))
);
CREATE TABLE `filing_affected_tax_items` (
	`filing_id` integer NOT NULL,
	`tax_item_id` integer NOT NULL,
	PRIMARY KEY(`filing_id`, `tax_item_id`),
	FOREIGN KEY (`filing_id`) REFERENCES `filings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE restrict
);
CREATE TABLE `cra_reference_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tax_year_id` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`person_id` integer,
	`document_date` text,
	`reporting_period_label` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tax_year_id`) REFERENCES `tax_years`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE restrict
);
CREATE TABLE `cra_reference_document_attachments` (
	`cra_reference_document_id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cra_reference_document_id`) REFERENCES `cra_reference_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cra_reference_document_attachment_size_valid" CHECK("cra_reference_document_attachments"."size_bytes" > 0 and "cra_reference_document_attachments"."size_bytes" <= 20971520)
);
CREATE TABLE `filing_item_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filing_id` integer NOT NULL,
	`tax_item_id` integer,
	`item_name` text NOT NULL,
	`owner_label` text NOT NULL,
	`tax_line_reference` text,
	`amount_cents` integer NOT NULL,
	`difference_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`filing_id`) REFERENCES `filings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tax_item_id`) REFERENCES `tax_items`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE IF NOT EXISTS "paycheques" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employment_id` integer NOT NULL,
	`pay_date` text NOT NULL,
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
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL, `tenure_paycheck_id` text, `synced_from_tenure` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`employment_id`) REFERENCES `employments`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "paycheque_amounts_non_negative" CHECK("paycheques"."gross_pay_cents" >= 0 and "paycheques"."income_tax_cents" >= 0 and "paycheques"."federal_income_tax_cents" >= 0 and "paycheques"."manitoba_income_tax_cents" >= 0 and "paycheques"."cpp_cents" >= 0 and "paycheques"."cpp2_cents" >= 0 and "paycheques"."ei_cents" >= 0 and "paycheques"."wi_cents" >= 0 and "paycheques"."ltd_cents" >= 0 and "paycheques"."extended_health_cents" >= 0 and "paycheques"."travel_medical_cents" >= 0 and "paycheques"."union_dues_cents" >= 0 and "paycheques"."other_deductions_cents" >= 0 and "paycheques"."net_pay_cents" >= 0)
);
CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric);
INSERT INTO __drizzle_migrations VALUES(NULL,'4b03102757cf735ae67d63fdc4de9b899cddc638b8be23b2d7308faad81b93e9',1788880886363);
INSERT INTO __drizzle_migrations VALUES(NULL,'1d885a166d7e1c524528bdeeb32d39a52f715c8c6af3297a7f9d04dbbc84dc72',1788908536636);
INSERT INTO __drizzle_migrations VALUES(NULL,'fbaf284dd50f77450a415946ea99c16ef72dbb0c7dc91cbe256ded1bfb4d19d2',1788910047965);
INSERT INTO __drizzle_migrations VALUES(NULL,'e33e8b2d2787158a9b02b7d61575cc41476af973ad473f74ea722eabc1e13a1b',1788928986939);
INSERT INTO __drizzle_migrations VALUES(NULL,'791fffc31d5101810ece5690e93f03b43ba4c66cb56f7b98ab2491ce508bbbeb',1788984462043);
INSERT INTO __drizzle_migrations VALUES(NULL,'386320a37c0c7cea2edd7c0bfb16995b848ee97bbbd2e9483f1632c7d9bd034f',1789511119756);
INSERT INTO __drizzle_migrations VALUES(NULL,'eb21d1018c8f5ebc64062a716b0c82b927b38e227c6836769ad0742db3fc6a59',1789524995247);
INSERT INTO __drizzle_migrations VALUES(NULL,'577ce76831f302262e587b5a4ce3cef1313ae484b6fcef84141b5a39490a7250',1789560724749);
INSERT INTO __drizzle_migrations VALUES(NULL,'dd19e71cc49815f150ecb5658dc28f2126fc89926a7cea9939211c7a51c7846b',1789561327567);
INSERT INTO __drizzle_migrations VALUES(NULL,'7dab902a0e9b56f49e29c42b12fe9debdf75c8e3fe057ac96f61f93191d883b1',1789591628592);
INSERT INTO __drizzle_migrations VALUES(NULL,'c48bae7135b95b73744573d300fd3c55d550aaa101b97ce51e25696c9aa3dde9',1789610034578);
INSERT INTO __drizzle_migrations VALUES(NULL,'9e9a20397bcaa081174395951bec0f17a8386023057064f413c52c035f61b49e',1789610851240);
INSERT INTO __drizzle_migrations VALUES(NULL,'ec369c641fbebd48a4e843726a0c645bc86c951b70f15a5c3a3d4713b8e82799',1789612000000);
INSERT INTO __drizzle_migrations VALUES(NULL,'dc62f648bde061616fe89cd75fb431e26654d5e9311fb35f41671ed209818f4d',1789613000000);
INSERT INTO __drizzle_migrations VALUES(NULL,'2af6e086df74df2b2dff948ea2e045bdbe2539bb1cceb6c1ce71eb5ac1c49124',1789650666432);
INSERT INTO __drizzle_migrations VALUES(NULL,'cd52d284133eb4f837167959244a3a45c433163c09a10c98d6cbb011a5d7e80d',1789820354445);
INSERT INTO __drizzle_migrations VALUES(NULL,'38e3a80abb0d6639ec5a7d50bbbdb222be790a3cd3cfb697d04f7c92472fac02',1789837940549);
INSERT INTO __drizzle_migrations VALUES(NULL,'505b63550ad1c8712a28f20a96a8d4187ba3810155e534dbb71e28e83f25b7ba',1789838678339);
PRAGMA writable_schema=ON;
CREATE TABLE IF NOT EXISTS sqlite_sequence(name,seq);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('tax_items',1);
INSERT INTO sqlite_sequence VALUES('paycheques',0);
INSERT INTO sqlite_sequence VALUES('households',1);
INSERT INTO sqlite_sequence VALUES('people',1);
INSERT INTO sqlite_sequence VALUES('tax_years',1);
INSERT INTO sqlite_sequence VALUES('records',1);
CREATE INDEX `people_household_idx` ON `people` (`household_id`);
CREATE UNIQUE INDEX `tax_year_household_year_unique` ON `tax_years` (`household_id`,`year`);
CREATE UNIQUE INDEX `tax_year_one_active_unique` ON `tax_years` (`household_id`) WHERE "tax_years"."is_active" = 1;
CREATE INDEX `employments_year_idx` ON `employments` (`tax_year_id`);
CREATE INDEX `employments_person_idx` ON `employments` (`person_id`);
CREATE UNIQUE INDEX `employments_tax_item_unique` ON `employments` (`tax_item_id`);
CREATE INDEX `records_tax_item_idx` ON `records` (`tax_item_id`);
CREATE INDEX `records_person_idx` ON `records` (`person_id`);
CREATE INDEX `records_date_idx` ON `records` (`date`);
CREATE INDEX `tax_documents_tax_item_idx` ON `tax_documents` (`tax_item_id`);
CREATE INDEX `tax_documents_person_idx` ON `tax_documents` (`person_id`);
CREATE INDEX `tax_documents_status_idx` ON `tax_documents` (`status`);
CREATE INDEX `business_activities_year_idx` ON `business_activities` (`tax_year_id`);
CREATE INDEX `business_activities_person_idx` ON `business_activities` (`person_id`);
CREATE UNIQUE INDEX `business_activities_tax_item_unique` ON `business_activities` (`tax_item_id`);
CREATE INDEX `business_records_activity_idx` ON `business_records` (`business_activity_id`);
CREATE INDEX `business_records_date_idx` ON `business_records` (`date`);
CREATE INDEX `tax_items_year_idx` ON `tax_items` (`tax_year_id`);
CREATE INDEX `tax_items_person_idx` ON `tax_items` (`person_id`);
CREATE UNIQUE INDEX `assessments_filing_unique` ON `assessments` (`filing_id`);
CREATE INDEX `assessments_date_idx` ON `assessments` (`assessment_date`);
CREATE UNIQUE INDEX `filings_original_return_unique` ON `filings` (`tax_year_id`,`person_id`) WHERE "filings"."kind" = 'original_return';
CREATE INDEX `filings_year_person_idx` ON `filings` (`tax_year_id`,`person_id`,`submission_date`);
CREATE INDEX `cra_reference_documents_year_idx` ON `cra_reference_documents` (`tax_year_id`);
CREATE INDEX `cra_reference_documents_person_idx` ON `cra_reference_documents` (`person_id`);
CREATE INDEX `filing_item_values_filing_idx` ON `filing_item_values` (`filing_id`);
CREATE UNIQUE INDEX `employments_phsp_tax_item_unique` ON `employments` (`phsp_tax_item_id`);
CREATE UNIQUE INDEX `employments_union_dues_tax_item_unique` ON `employments` (`union_dues_tax_item_id`);
CREATE INDEX `paycheques_employment_idx` ON `paycheques` (`employment_id`);
CREATE INDEX `paycheques_date_idx` ON `paycheques` (`pay_date`);
CREATE UNIQUE INDEX `paycheques_tenure_paycheck_unique` ON `paycheques` (`tenure_paycheck_id`);
PRAGMA writable_schema=OFF;
COMMIT;
