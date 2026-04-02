CREATE TABLE `email_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`smtpHost` varchar(256),
	`smtpPort` int DEFAULT 465,
	`smtpSecure` boolean DEFAULT true,
	`smtpUser` varchar(320),
	`smtpPassword` varchar(256),
	`fromEmail` varchar(320),
	`toEmails` json,
	`isEnabled` boolean DEFAULT false,
	`cooldownMinutes` int DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `indicators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`tdxCode` text NOT NULL,
	`pythonCode` text,
	`convertStatus` enum('pending','success','error') DEFAULT 'pending',
	`convertError` text,
	`appliedContracts` json,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indicators_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kline_cache` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`contract` varchar(64) NOT NULL,
	`period` int NOT NULL,
	`datetime` bigint NOT NULL,
	`open` float,
	`high` float,
	`low` float,
	`close` float,
	`volume` float,
	`openInterest` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kline_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signal_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`indicatorId` int,
	`indicatorName` varchar(128),
	`contract` varchar(64) NOT NULL,
	`signalType` enum('buy','sell','alert') NOT NULL,
	`price` float,
	`signalValue` float,
	`description` text,
	`emailSent` boolean DEFAULT false,
	`emailSentAt` timestamp,
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signal_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tq_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tqUsername` varchar(128),
	`tqPassword` varchar(256),
	`subscribedContracts` json,
	`klinePeriod` int DEFAULT 60,
	`isEnabled` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tq_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `tq_configs_userId_unique` UNIQUE(`userId`)
);
