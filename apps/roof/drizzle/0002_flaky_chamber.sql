CREATE TABLE `insurance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text,
	`policy_number` text,
	`starts_on` text,
	`ends_on` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `insurance_property_idx` ON `insurance_records` (`property_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `insurance_id` text REFERENCES insurance_records(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `relationship` text DEFAULT 'purchase' NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `stage` text DEFAULT 'under_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `possession_date` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `photo_file_id` text REFERENCES yt_files(id);
--> statement-breakpoint
UPDATE properties SET relationship = CASE WHEN kind IN ('current_rental', 'past_rental') THEN 'rental' ELSE 'purchase' END,
 stage = CASE kind WHEN 'current_rental' THEN 'current' WHEN 'past_rental' THEN 'past' WHEN 'owned' THEN 'owned' ELSE 'under_construction' END;
--> statement-breakpoint
INSERT INTO insurance_records (id, property_id, type, provider, policy_number, ends_on, notes, created_at, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-8' || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
 id, 'tenant', renter_insurance_provider, renter_insurance_policy_number, renter_insurance_expires_on,
 'Migrated from property insurance details. The legacy renewal or expiry date is recorded as coverage end; confirm it against the policy document.', created_at, updated_at
FROM properties
WHERE renter_insurance_provider IS NOT NULL OR renter_insurance_policy_number IS NOT NULL OR renter_insurance_expires_on IS NOT NULL;
