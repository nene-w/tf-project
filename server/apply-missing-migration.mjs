#!/usr/bin/env node
/**
 * Manually apply missing migration for tq_configs table
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable not set");
  process.exit(1);
}

console.log("Applying missing migration for tq_configs...");

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

  // Check if tq_configs table exists
  console.log("\n1. Checking if tq_configs table exists...");
  const [tables] = await connection.execute(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tq_configs'"
  );

  if (tables.length > 0) {
    console.log("✓ tq_configs table already exists");
  } else {
    console.log("✗ tq_configs table does not exist, creating...");
    
    // Create the table
    const createTableSQL = `
      CREATE TABLE \`tq_configs\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`tqUsername\` varchar(128),
        \`tqPassword\` varchar(256),
        \`subscribedContracts\` json,
        \`klinePeriod\` int DEFAULT 60,
        \`isEnabled\` boolean DEFAULT false,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`tq_configs_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`tq_configs_userId_unique\` UNIQUE(\`userId\`)
      );
    `;
    
    await connection.execute(createTableSQL);
    console.log("✓ tq_configs table created successfully");
  }

  // Check other tables
  console.log("\n2. Checking other required tables...");
  const requiredTables = [
    'email_configs',
    'indicators',
    'kline_cache',
    'signal_records',
  ];

  for (const tableName of requiredTables) {
    const [result] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      [tableName]
    );
    
    if (result.length > 0) {
      console.log(`✓ ${tableName} exists`);
    } else {
      console.log(`✗ ${tableName} does not exist`);
    }
  }

  await connection.end();
  console.log("\n✓ Migration check completed!");
  process.exit(0);

} catch (error) {
  console.error("\n✗ Migration failed:");
  console.error(error);
  process.exit(1);
}
