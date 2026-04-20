import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import { eq, desc, and, sql, inArray, like, or } from "drizzle-orm";
import { ENV } from "./_core/env";

let db: any = null;

export async function getDb() {
  if (!db) {
    const connection = await mysql.createConnection(ENV.databaseUrl);
    db = drizzle(connection, { schema, mode: "default" });
  }
  return db;
}

// 彻底废除所有过滤逻辑，仅返回 LocalPush 数据
export async function getFundamentalData(options: { dataType?: string; limit?: number } = {}) {
  const d = await getDb();
  const { dataType, limit = 500 } = options;

  // 1. 获取每个指标的最新日期
  // 我们只信任 LocalPush 来源的数据
  const latestDatesQuery = d
    .select({
      indicator: schema.fundamentalData.indicator,
      maxDate: sql<string>`MAX(${schema.fundamentalData.releaseDate})`.as("max_date"),
    })
    .from(schema.fundamentalData)
    .where(eq(schema.fundamentalData.source, "LocalPush"))
    .groupBy(schema.fundamentalData.indicator);

  const latestDates = await latestDatesQuery;

  if (latestDates.length === 0) {
    return [];
  }

  // 2. 根据最新日期获取完整记录
  const conditions = latestDates.map((ld) => 
    and(
      eq(schema.fundamentalData.indicator, ld.indicator),
      eq(schema.fundamentalData.releaseDate, ld.maxDate),
      eq(schema.fundamentalData.source, "LocalPush")
    )
  );

  let query = d
    .select()
    .from(schema.fundamentalData)
    .where(or(...conditions))
    .orderBy(desc(schema.fundamentalData.releaseDate));

  if (limit) {
    query = query.limit(limit);
  }

  const results = await query;

  // 3. 如果指定了 dataType，在内存中进行过滤（为了兼容前端分类）
  if (dataType && dataType !== "all") {
    // 兼容前端分类映射
    const tabMap: Record<string, string> = {
      "macro": "macro",
      "liquidity": "liquidity",
      "bond_market": "supply",
      "supply": "supply",
      "sentiment": "sentiment",
      "external": "external"
    };
    const targetType = tabMap[dataType] || dataType;
    return results.filter((item: any) => item.dataType === targetType);
  }

  return results;
}

export async function createFundamentalData(data: any) {
  const d = await getDb();
  return await d.insert(schema.fundamentalData).values(data);
}

export async function getFundamentalAnalyses(options: { limit?: number; offset?: number } = {}) {
  const d = await getDb();
  const { limit = 10, offset = 0 } = options;
  return await d.query.fundamentalAnalysis.findMany({
    limit,
    offset,
    orderBy: [desc(schema.fundamentalAnalysis.createdAt)],
  });
}

export async function createFundamentalAnalysis(data: any) {
  const d = await getDb();
  return await d.insert(schema.fundamentalAnalysis).values(data);
}

// 保持其他函数兼容性
export async function upsertKlineCache(data: any) {
  const d = await getDb();
  return await d.insert(schema.klineCache).values(data).onDuplicateKeyUpdate({
    set: {
      data: data.data,
      updatedAt: new Date(),
    },
  });
}

export async function getKlineCache(symbol: string, interval: string) {
  const d = await getDb();
  return await d.query.klineCache.findFirst({
    where: and(
      eq(schema.klineCache.symbol, symbol),
      eq(schema.klineCache.interval, interval)
    ),
  });
}
