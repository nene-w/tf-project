#!/usr/bin/env node
/**
 * Database connection test script
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { tqConfigs } from "../drizzle/schema.ts";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable not set");
  process.exit(1);
}

console.log("Testing database connection...");
console.log("DATABASE_URL:", DATABASE_URL.substring(0, 50) + "...");

try {
  const db = drizzle(DATABASE_URL);
  
  console.log("\n1. Testing SELECT query on tq_configs...");
  const result = await db
    .select()
    .from(tqConfigs)
    .where(eq(tqConfigs.userId, 1))
    .limit(1);
  
  console.log("✓ SELECT query successful");
  console.log("Result:", result);
  
  console.log("\n2. Testing INSERT query on tq_configs...");
  const insertResult = await db
    .insert(tqConfigs)
    .values({
      userId: 1,
      tqUsername: "test_user",
      tqPassword: "test_pass",
      subscribedContracts: ["KQ.m@CFFEX.T"],
      klinePeriod: 60,
      isEnabled: true,
    })
    .onDuplicateKeyUpdate({
      set: {
        tqUsername: "test_user",
        tqPassword: "test_pass",
        subscribedContracts: ["KQ.m@CFFEX.T"],
        klinePeriod: 60,
        isEnabled: true,
      },
    });
  
  console.log("✓ INSERT/UPSERT query successful");
  console.log("Result:", insertResult);
  
  console.log("\n3. Testing SELECT after INSERT...");
  const afterInsert = await db
    .select()
    .from(tqConfigs)
    .where(eq(tqConfigs.userId, 1))
    .limit(1);
  
  console.log("✓ SELECT after INSERT successful");
  console.log("Result:", afterInsert);
  
  console.log("\n✓ All database tests passed!");
  process.exit(0);
  
} catch (error) {
  console.error("\n✗ Database test failed:");
  console.error(error);
  process.exit(1);
}
