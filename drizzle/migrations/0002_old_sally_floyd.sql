CREATE TABLE `brief_metadata` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brief_id` int NOT NULL,
	`source_url` varchar(255),
	`summary` text,
	`signal_count` int DEFAULT 0,
	`theme_count` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_metadata_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brief_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brief_id` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`value` varchar(255) NOT NULL,
	`trend` varchar(50) NOT NULL,
	`trend_icon` varchar(50),
	`section_index` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brief_themes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brief_id` int NOT NULL,
	`theme` varchar(100) NOT NULL,
	`frequency` int NOT NULL DEFAULT 1,
	`section_indices` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brief_themes_id` PRIMARY KEY(`id`)
);
