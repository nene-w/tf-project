CREATE TABLE `weekly_flame_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`content` text NOT NULL,
	`dimensionScores` json,
	`keyExpectationGaps` text,
	`viewIds` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_flame_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `external_views` ADD `flameDimension` varchar(10);--> statement-breakpoint
ALTER TABLE `external_views` ADD `sentimentScore` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `external_views` ADD `expectationGap` text;