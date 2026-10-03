ALTER TABLE `employers` ADD `email` text;--> statement-breakpoint
ALTER TABLE `employers` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `employers` ADD `address_line_1` text;--> statement-breakpoint
ALTER TABLE `employers` ADD `address_line_2` text;--> statement-breakpoint
ALTER TABLE `employers` ADD `city` text;--> statement-breakpoint
ALTER TABLE `employers` ADD `region` text;--> statement-breakpoint
ALTER TABLE `employers` ADD `postal_code` text;--> statement-breakpoint
ALTER TABLE `employers` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `employers` ADD `icon_file_id` text REFERENCES yt_files(id);