#!/usr/bin/env node
/**
 * Create all missing tables
 */

import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable not set");
  process.exit(1);
}

console.log("Creating all missing tables...");

try {
  // Parse the DATABASE_URL
  const url = new URL(DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    port: url.port || 3306,
    ssl: {},  // Enable SSL for TiDB Cloud
  });

  const tables = [
    {
      name: 'email_configs',
      sql: `CREATE TABLE IF NOT EXISTS \`email_configs\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`smtpHost\` varchar(256),
        \`smtpPort\` int DEFAULT 465,
        \`smtpSecure\` boolean DEFAULT true,
        \`smtpUser\` varchar(320),
        \`smtpPassword\` varchar(256),
        \`fromEmail\` varchar(320),
        \`toEmails\` json,
        \`isEnabled\` boolean DEFAULT false,
        \`cooldownMinutes\` int DEFAULT 30,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`email_configs_id\` PRIMARY KEY(\`id\`)
      )`
    },
    {
      name: 'indicators',
      sql: `CREATE TABLE IF NOT EXISTS \`indicators\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`description\` text,
        \`tdxCode\` text NOT NULL,
        \`pythonCode\` text,
        \`convertStatus\` enum('pending','success','error') DEFAULT 'pending',
        \`convertError\` text,
        \`appliedContracts\` json,
        \`isActive\` boolean DEFAULT true,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`indicators_id\` PRIMARY KEY(\`id\`)
      )`
    },
    {
      name: 'kline_cache',
      sql: `CREATE TABLE IF NOT EXISTS \`kline_cache\` (
        \`id\` bigint AUTO_INCREMENT NOT NULL,
        \`contract\` varchar(64) NOT NULL,
        \`period\` int NOT NULL,
        \`datetime\` bigint NOT NULL,
        \`open\` float,
        \`high\` float,
        \`low\` float,
        \`close\` float,
        \`volume\` float,
        \`openInterest\` float,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`kline_cache_id\` PRIMARY KEY(\`id\`)
      )`
    },
    {
      name: 'signal_records',
      sql: `CREATE TABLE IF NOT EXISTS \`signal_records\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`indicatorId\` int,
        \`indicatorName\` varchar(128),
        \`contract\` varchar(64) NOT NULL,
        \`signalType\` enum('buy','sell','alert') NOT NULL,
        \`price\` float,
        \`signalValue\` float,
        \`description\` text,
        \`emailSent\` boolean DEFAULT false,
        \`emailSentAt\` timestamp,
        \`triggeredAt\` timestamp NOT NULL DEFAULT (now()),
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`signal_records_id\` PRIMARY KEY(\`id\`)
      )`
    },
  ];

  for (const table of tables) {
    try {
      console.log(`\nCreating ${table.name}...`);
      await connection.execute(table.sql);
      console.log(`✓ ${table.name} created successfully`);
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log(`✓ ${table.name} already exists`);
      } else {
        throw error;
      }
    }
  }

  await connection.end();
  console.log("\n✓ All tables created successfully!");
  process.exit(0);

} catch (error) {
  console.error("\n✗ Failed to create tables:");
  console.error(error);
  process.exit(1);
}
