import { drizzle } from "drizzle-orm/mysql2";
import { like, or } from "drizzle-orm";
import { fundamentalData } from "../drizzle/schema.ts";
import dotenv from "dotenv";

dotenv.config();

async function cleanup() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not found");
    return;
  }

  const db = drizzle(process.env.DATABASE_URL);
  console.log("Starting database cleanup for test indicators...");

  try {
    // 删除所有名称包含“测试”或“test”的指标
    const result = await db.delete(fundamentalData).where(
      or(
        like(fundamentalData.indicator, "%测试%"),
        like(fundamentalData.indicator, "%test%"),
        like(fundamentalData.indicator, "%Test%")
      )
    );
    
    console.log("Cleanup completed successfully.");
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}

cleanup();
