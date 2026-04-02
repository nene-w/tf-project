#!/usr/bin/env node
/**
 * Run pending database migrations
 */

import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable not set");
  process.exit(1);
}

console.log("Running database migrations...");
console.log("DATABASE_URL:", DATABASE_URL.substring(0, 50) + "...");

try {
  const db = drizzle(DATABASE_URL);
  
  const migrationsFolder = path.join(__dirname, "../drizzle");
  console.log("Migrations folder:", migrationsFolder);
  
  await migrate(db, { migrationsFolder });
  
  console.log("✓ Migrations completed successfully!");
  process.exit(0);
  
} catch (error) {
  console.error("\n✗ Migration failed:");
  console.error(error);
  process.exit(1);
}
