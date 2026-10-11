ALTER TABLE `property_events` ADD `event_time` text;--> statement-breakpoint
ALTER TABLE `property_events` ADD `status` text DEFAULT 'completed' NOT NULL;