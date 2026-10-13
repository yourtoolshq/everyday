CREATE TABLE `lease_records` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`title` text NOT NULL,
	`term_type` text NOT NULL,
	`starts_on` text,
	`ends_on` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lease_property_idx` ON `lease_records` (`property_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `lease_id` text REFERENCES lease_records(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `documents_lease_id_idx` ON `documents` (`lease_id`);
--> statement-breakpoint
INSERT INTO lease_records (id, property_id, title, term_type, starts_on, ends_on, notes)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-8' || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
 id, 'Existing lease', 'fixed_term', lease_start_date, lease_end_date, lease_notes
FROM properties WHERE relationship = 'rental' AND
 (lease_start_date IS NOT NULL OR lease_end_date IS NOT NULL OR NULLIF(trim(lease_notes), '') IS NOT NULL);
