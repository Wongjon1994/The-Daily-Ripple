CREATE TABLE `n8n_briefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(64) NOT NULL,
	`date_slug` varchar(64) NOT NULL,
	`sections` json NOT NULL,
	`telegraph_url` varchar(255),
	`dashboard_url` varchar(255) NOT NULL,
	`raw_payload` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `n8n_briefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `n8n_briefs_date_slug_unique` UNIQUE(`date_slug`)
);
