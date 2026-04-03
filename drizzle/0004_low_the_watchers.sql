CREATE TABLE `ai_analyst_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`apiType` varchar(50) DEFAULT 'openai_compatible',
	`apiBaseUrl` varchar(500),
	`apiKey` varchar(500),
	`modelName` varchar(100) DEFAULT 'gpt-4.1-mini',
	`systemPrompt` text,
	`temperature` float DEFAULT 0.7,
	`maxTokens` int DEFAULT 4000,
	`isEnabled` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_analyst_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_analyst_configs_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `ai_analyst_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`contract` varchar(10) NOT NULL,
	`content` text NOT NULL,
	`trendConclusion` enum('bullish','bearish','neutral') NOT NULL,
	`confidenceScore` int DEFAULT 50,
	`flameScores` json,
	`technicalSummary` text,
	`supportLevels` json,
	`resistanceLevels` json,
	`expectationGaps` text,
	`dataSources` json,
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_analyst_reports_id` PRIMARY KEY(`id`)
);
