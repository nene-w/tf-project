CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
CREATE TABLE IF NOT EXISTS `dashboard_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`layout` json,
	`widgets` json,
	`defaultTimeRange` varchar(50) DEFAULT '7d',
	`showRiskWarning` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dashboard_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_configs_userId_unique` UNIQUE(`userId`)
);
CREATE TABLE IF NOT EXISTS `email_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`signalType` enum('buy','sell','hold','unknown') NOT NULL,
	`contract` varchar(50) NOT NULL,
	`price` decimal(10,4),
	`emailSubject` text,
	`emailContent` text,
	`signalTime` timestamp,
	`confidence` int DEFAULT 50,
	`status` enum('pending','executed','expired','cancelled') DEFAULT 'pending',
	`userNotes` text,
	`emailId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_signals_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `external_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceType` varchar(100) NOT NULL,
	`sourceName` varchar(255) NOT NULL,
	`author` varchar(255),
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`fullContent` text,
	`engagement` int DEFAULT 0,
	`publishDate` timestamp,
	`url` varchar(500),
	`sentiment` enum('bullish','bearish','neutral') DEFAULT 'neutral',
	`relatedContracts` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `external_views_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `fundamental_analysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`recommendation` enum('strong_buy','buy','hold','sell','strong_sell') NOT NULL,
	`keyIndicators` json,
	`riskLevel` enum('low','medium','high') DEFAULT 'medium',
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fundamental_analysis_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `fundamental_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dataType` varchar(100) NOT NULL,
	`indicator` varchar(255) NOT NULL,
	`value` decimal(15,4),
	`unit` varchar(50),
	`releaseDate` timestamp,
	`effectiveDate` timestamp,
	`source` varchar(255),
	`description` text,
	`analyzed` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fundamental_data_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `trade_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contract` varchar(50) NOT NULL,
	`direction` enum('long','short') NOT NULL,
	`entryPrice` decimal(10,4) NOT NULL,
	`entryTime` timestamp NOT NULL,
	`exitPrice` decimal(10,4),
	`exitTime` timestamp,
	`quantity` int NOT NULL,
	`profitLoss` decimal(15,4),
	`profitLossRate` decimal(5,2),
	`status` enum('open','closed') NOT NULL,
	`notes` text,
	`relatedSignalId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trade_records_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `trade_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tradeId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`strengths` text,
	`weaknesses` text,
	`improvements` text,
	`overallScore` int DEFAULT 50,
	`keyLearnings` text,
	`status` enum('draft','completed') DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trade_reviews_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `view_conclusions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`conclusion` text NOT NULL,
	`viewIds` json,
	`overallSentiment` enum('bullish','bearish','neutral') DEFAULT 'neutral',
	`consensusScore` int DEFAULT 50,
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `view_conclusions_id` PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `weekly_flame_reports` (
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
ALTER TABLE `external_views` ADD `flameDimension` varchar(10);
ALTER TABLE `external_views` ADD `sentimentScore` int DEFAULT 0;
ALTER TABLE `external_views` ADD `expectationGap` text;
