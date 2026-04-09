import { drizzle } from "drizzle-orm/mysql2";
import { eq, desc } from "drizzle-orm";
import { fundamentalData } from "../drizzle/schema.ts";
import dotenv from "dotenv";

dotenv.config();

async function cleanup() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not found");
    return;
  }

  const db = drizzle(process.env.DATABASE_URL);
  console.log("Starting database cleanup...");

  try {
    // 1. 获取所有指标
    const allRecords = await db.select().from(fundamentalData).orderBy(desc(fundamentalData.releaseDate));
    
    const latestIds = new Set();
    const indicatorMap = new Map();

    for (const record of allRecords) {
      const key = `${record.dataType}:${record.indicator}`;
      if (!indicatorMap.has(key)) {
        indicatorMap.set(key, record.id);
        latestIds.add(record.id);
      }
    }

    console.log(`Found ${latestIds.size} unique indicators. Total records: ${allRecords.length}`);

    if (allRecords.length > latestIds.size) {
      const idsToDelete = allRecords
        .map(r => r.id)
        .filter(id => !latestIds.has(id));

      console.log(`Deleting ${idsToDelete.length} redundant records...`);
      
      for (const id of idsToDelete) {
        await db.delete(fundamentalData).where(eq(fundamentalData.id, id));
      }
      console.log("Cleanup completed successfully.");
    } else {
      console.log("No redundant records found.");
    }
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}

cleanup();
