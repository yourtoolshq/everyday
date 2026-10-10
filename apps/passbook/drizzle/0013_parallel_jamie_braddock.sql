CREATE TABLE `document_enrichments` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`kind` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`entry_method` text DEFAULT 'manual' NOT NULL,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_enrichments_document_kind_unique` ON `document_enrichments` (`document_id`,`kind`);--> statement-breakpoint
CREATE INDEX `document_enrichments_document_idx` ON `document_enrichments` (`document_id`);--> statement-breakpoint
CREATE TABLE `investment_instrument_identifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`instrument_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`namespace` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `investment_instruments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investment_instrument_identifiers_unique` ON `investment_instrument_identifiers` (`kind`,`value`,`namespace`);--> statement-breakpoint
CREATE INDEX `investment_instrument_identifiers_instrument_idx` ON `investment_instrument_identifiers` (`instrument_id`);--> statement-breakpoint
CREATE TABLE `investment_instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`display_name` text NOT NULL,
	`series` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `investment_statement_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`instrument_id` text,
	`line_kind` text NOT NULL,
	`source_label` text NOT NULL,
	`source_identifier` text,
	`source_series` text,
	`value_currency` text NOT NULL,
	`market_value` text,
	`quantity` text,
	`unit_price` text,
	`unit_price_currency` text,
	`book_cost` text,
	`book_cost_currency` text,
	`source_page` integer,
	`source_note` text,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `investment_statement_snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `investment_instruments`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `investment_statement_positions_snapshot_idx` ON `investment_statement_positions` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `investment_statement_positions_instrument_idx` ON `investment_statement_positions` (`instrument_id`);--> statement-breakpoint
CREATE TABLE `investment_statement_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`enrichment_id` text NOT NULL,
	`valuation_date` text NOT NULL,
	`coverage_start` text,
	`coverage_end` text,
	`summary_coverage` text DEFAULT 'not_entered' NOT NULL,
	`holdings_coverage` text DEFAULT 'not_entered' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enrichment_id`) REFERENCES `document_enrichments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investment_statement_snapshots_enrichment_unique` ON `investment_statement_snapshots` (`enrichment_id`);--> statement-breakpoint
CREATE INDEX `investment_statement_snapshots_valuation_idx` ON `investment_statement_snapshots` (`valuation_date`);--> statement-breakpoint
CREATE TABLE `investment_statement_totals` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`currency` text NOT NULL,
	`scope` text NOT NULL,
	`closing_value` text,
	`opening_value` text,
	`cash` text,
	`book_cost` text,
	`contributions` text,
	`withdrawals` text,
	`transfers_in` text,
	`transfers_out` text,
	`income` text,
	`fees` text,
	`reported_value_change` text,
	`source_page` integer,
	`source_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `investment_statement_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investment_statement_totals_snapshot_currency_scope` ON `investment_statement_totals` (`snapshot_id`,`currency`,`scope`);--> statement-breakpoint
CREATE INDEX `investment_statement_totals_snapshot_idx` ON `investment_statement_totals` (`snapshot_id`);