CREATE TABLE `daily_briefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brief_date` varchar(10) NOT NULL,
	`date_label` varchar(64) NOT NULL,
	`greeting` text NOT NULL,
	`stories` json NOT NULL,
	`connections` json NOT NULL,
	`ticker_items` json NOT NULL,
	`historical_parallel` json NOT NULL,
	`culture_note` json NOT NULL,
	`systems_synthesis` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_briefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_briefs_brief_date_unique` UNIQUE(`brief_date`)
);
--> statement-breakpoint
CREATE TABLE `market_ticker` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticker_data` json NOT NULL,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_ticker_id` PRIMARY KEY(`id`)
);
