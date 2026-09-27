-- yt:reviewed-destructive
CREATE TABLE `yt_files` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text,
	`endpoint` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `yt_files_storage_key_unique` ON `yt_files` (`storage_key`);
--> statement-breakpoint
CREATE TABLE `yt_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `yt_files` (`id`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, `endpoint`, `created_at`)
SELECT 'record-' || record_id,
       printf('00000000-0000-4000-8000-0001%08x', record_id) || '.' || CASE lower(mime_type) WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'image/heic' THEN 'heic' WHEN 'image/heif' THEN 'heic' END,
       file_name, mime_type, size_bytes, 'document', created_at FROM record_attachments
UNION ALL
SELECT 'tax-document-' || tax_document_id,
       printf('00000000-0000-4000-8000-0002%08x', tax_document_id) || '.' || CASE lower(mime_type) WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'image/heic' THEN 'heic' WHEN 'image/heif' THEN 'heic' END,
       file_name, mime_type, size_bytes, 'document', created_at FROM tax_document_attachments
UNION ALL
SELECT 'business-record-' || business_record_id,
       printf('00000000-0000-4000-8000-0003%08x', business_record_id) || '.' || CASE lower(mime_type) WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'image/heic' THEN 'heic' WHEN 'image/heif' THEN 'heic' END,
       file_name, mime_type, size_bytes, 'document', created_at FROM business_record_attachments
UNION ALL
SELECT 'filing-' || filing_id,
       printf('00000000-0000-4000-8000-0004%08x', filing_id) || '.' || CASE lower(mime_type) WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'image/heic' THEN 'heic' WHEN 'image/heif' THEN 'heic' END,
       file_name, mime_type, size_bytes, 'document', created_at FROM filing_attachments
UNION ALL
SELECT 'assessment-' || assessment_id,
       printf('00000000-0000-4000-8000-0005%08x', assessment_id) || '.' || CASE lower(mime_type) WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'image/heic' THEN 'heic' WHEN 'image/heif' THEN 'heic' END,
       file_name, mime_type, size_bytes, 'document', created_at FROM assessment_attachments
UNION ALL
SELECT 'cra-reference-document-' || cra_reference_document_id,
       printf('00000000-0000-4000-8000-0006%08x', cra_reference_document_id) || '.' || CASE lower(mime_type) WHEN 'application/pdf' THEN 'pdf' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' WHEN 'image/heic' THEN 'heic' WHEN 'image/heif' THEN 'heic' END,
       file_name, mime_type, size_bytes, 'document', created_at FROM cra_reference_document_attachments;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_record_attachments` (`record_id` integer PRIMARY KEY NOT NULL REFERENCES records(id) ON DELETE cascade, `file_name` text NOT NULL, `mime_type` text NOT NULL, `size_bytes` integer NOT NULL, `file_id` text NOT NULL REFERENCES yt_files(id) ON DELETE cascade, `created_at` integer DEFAULT (unixepoch()) NOT NULL, `updated_at` integer DEFAULT (unixepoch()) NOT NULL, CONSTRAINT `record_attachment_size_valid` CHECK (`size_bytes` > 0 and `size_bytes` <= 20971520));
--> statement-breakpoint
INSERT INTO `__new_record_attachments` SELECT record_id, file_name, mime_type, size_bytes, 'record-' || record_id, created_at, updated_at FROM record_attachments;
--> statement-breakpoint
DROP TABLE `record_attachments`;
--> statement-breakpoint
ALTER TABLE `__new_record_attachments` RENAME TO `record_attachments`;
--> statement-breakpoint
CREATE TABLE `__new_tax_document_attachments` (`tax_document_id` integer PRIMARY KEY NOT NULL REFERENCES tax_documents(id) ON DELETE cascade, `file_name` text NOT NULL, `mime_type` text NOT NULL, `size_bytes` integer NOT NULL, `file_id` text NOT NULL REFERENCES yt_files(id) ON DELETE cascade, `created_at` integer DEFAULT (unixepoch()) NOT NULL, `updated_at` integer DEFAULT (unixepoch()) NOT NULL, CONSTRAINT `tax_document_attachment_size_valid` CHECK (`size_bytes` > 0 and `size_bytes` <= 20971520));
--> statement-breakpoint
INSERT INTO `__new_tax_document_attachments` SELECT tax_document_id, file_name, mime_type, size_bytes, 'tax-document-' || tax_document_id, created_at, updated_at FROM tax_document_attachments;
--> statement-breakpoint
DROP TABLE `tax_document_attachments`;
--> statement-breakpoint
ALTER TABLE `__new_tax_document_attachments` RENAME TO `tax_document_attachments`;
--> statement-breakpoint
CREATE TABLE `__new_business_record_attachments` (`business_record_id` integer PRIMARY KEY NOT NULL REFERENCES business_records(id) ON DELETE cascade, `file_name` text NOT NULL, `mime_type` text NOT NULL, `size_bytes` integer NOT NULL, `file_id` text NOT NULL REFERENCES yt_files(id) ON DELETE cascade, `created_at` integer DEFAULT (unixepoch()) NOT NULL, `updated_at` integer DEFAULT (unixepoch()) NOT NULL, CONSTRAINT `business_record_attachment_size_valid` CHECK (`size_bytes` > 0 and `size_bytes` <= 20971520));
--> statement-breakpoint
INSERT INTO `__new_business_record_attachments` SELECT business_record_id, file_name, mime_type, size_bytes, 'business-record-' || business_record_id, created_at, updated_at FROM business_record_attachments;
--> statement-breakpoint
DROP TABLE `business_record_attachments`;
--> statement-breakpoint
ALTER TABLE `__new_business_record_attachments` RENAME TO `business_record_attachments`;
--> statement-breakpoint
CREATE TABLE `__new_filing_attachments` (`filing_id` integer PRIMARY KEY NOT NULL REFERENCES filings(id) ON DELETE cascade, `file_name` text NOT NULL, `mime_type` text NOT NULL, `size_bytes` integer NOT NULL, `file_id` text NOT NULL REFERENCES yt_files(id) ON DELETE cascade, `created_at` integer DEFAULT (unixepoch()) NOT NULL, `updated_at` integer DEFAULT (unixepoch()) NOT NULL, CONSTRAINT `filing_attachment_size_valid` CHECK (`size_bytes` > 0 and `size_bytes` <= 20971520));
--> statement-breakpoint
INSERT INTO `__new_filing_attachments` SELECT filing_id, file_name, mime_type, size_bytes, 'filing-' || filing_id, created_at, updated_at FROM filing_attachments;
--> statement-breakpoint
DROP TABLE `filing_attachments`;
--> statement-breakpoint
ALTER TABLE `__new_filing_attachments` RENAME TO `filing_attachments`;
--> statement-breakpoint
CREATE TABLE `__new_assessment_attachments` (`assessment_id` integer PRIMARY KEY NOT NULL REFERENCES assessments(id) ON DELETE cascade, `file_name` text NOT NULL, `mime_type` text NOT NULL, `size_bytes` integer NOT NULL, `file_id` text NOT NULL REFERENCES yt_files(id) ON DELETE cascade, `created_at` integer DEFAULT (unixepoch()) NOT NULL, `updated_at` integer DEFAULT (unixepoch()) NOT NULL, CONSTRAINT `assessment_attachment_size_valid` CHECK (`size_bytes` > 0 and `size_bytes` <= 20971520));
--> statement-breakpoint
INSERT INTO `__new_assessment_attachments` SELECT assessment_id, file_name, mime_type, size_bytes, 'assessment-' || assessment_id, created_at, updated_at FROM assessment_attachments;
--> statement-breakpoint
DROP TABLE `assessment_attachments`;
--> statement-breakpoint
ALTER TABLE `__new_assessment_attachments` RENAME TO `assessment_attachments`;
--> statement-breakpoint
CREATE TABLE `__new_cra_reference_document_attachments` (`cra_reference_document_id` integer PRIMARY KEY NOT NULL REFERENCES cra_reference_documents(id) ON DELETE cascade, `file_name` text NOT NULL, `mime_type` text NOT NULL, `size_bytes` integer NOT NULL, `file_id` text NOT NULL REFERENCES yt_files(id) ON DELETE cascade, `created_at` integer DEFAULT (unixepoch()) NOT NULL, `updated_at` integer DEFAULT (unixepoch()) NOT NULL, CONSTRAINT `cra_reference_document_attachment_size_valid` CHECK (`size_bytes` > 0 and `size_bytes` <= 20971520));
--> statement-breakpoint
INSERT INTO `__new_cra_reference_document_attachments` SELECT cra_reference_document_id, file_name, mime_type, size_bytes, 'cra-reference-document-' || cra_reference_document_id, created_at, updated_at FROM cra_reference_document_attachments;
--> statement-breakpoint
DROP TABLE `cra_reference_document_attachments`;
--> statement-breakpoint
ALTER TABLE `__new_cra_reference_document_attachments` RENAME TO `cra_reference_document_attachments`;
