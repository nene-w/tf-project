import { eq, desc, and, gte, lte, notLike } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  emailSignals,
  fundamentalData,
  fundamentalAnalysis,
  externalViews,
  viewConclusions,
  tradeRecords,
  tradeReviews,
  dashboardConfigs,
  weeklyFlameReports,
  tqConfigs,
  indicators,
  signalRecords,
  emailConfigs,
  klineCache,
  aiAnalystConfigs,
  aiAnalystReports,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Email Signals ============
export async function getEmailSignals(userId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(emailSignals)
    .where(eq(emailSignals.userId, userId))
    .orderBy(desc(emailSignals.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createEmailSignal(signal: typeof emailSignals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(emailSignals).values(signal);
  return result;
}

export async function updateEmailSignal(
  id: number,
  updates: Partial<typeof emailSignals.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(emailSignals).set(updates).where(eq(emailSignals.id, id));
}

// ============ Fundamental Analysis ============
export async function getFundamentalAnalysis(userId: number, limit = 10, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(fundamentalAnalysis)
    .where(eq(fundamentalAnalysis.userId, userId))
    .orderBy(desc(fundamentalAnalysis.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createFundamentalAnalysis(
  analysis: typeof fundamentalAnalysis.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(fundamentalAnalysis).values(analysis);
}

// ============ Fundamental Data ============
export async function getFundamentalData(
  dataType?: string,
  limit = 100,
  offset = 0
) {
  const db = await getDb();
  if (!db) return [];

  try {
    // 核心逻辑修改：只查询来源为 "LocalPush" 的数据，彻底隔离旧的 AKShare 数据
    const conditions = [
      eq(fundamentalData.source, "LocalPush")
    ];
    
    // 映射前端传来的分类名称到数据库分类
    let targetDataType = dataType;
    if (dataType === "F") targetDataType = "macro";
    if (dataType === "L") targetDataType = "liquidity";
    if (dataType === "A") targetDataType = "supply";
    if (dataType === "M") targetDataType = "sentiment";
    if (dataType === "E") targetDataType = "external";

    if (targetDataType && targetDataType !== "all") {
      conditions.push(eq(fundamentalData.dataType, targetDataType));
    }

    const allData = await db
      .select()
      .from(fundamentalData)
      .where(and(...conditions))
      .orderBy(desc(fundamentalData.releaseDate));

    // 按指标名称分组，只保留每个指标最新日期的数据
    const latestMap = new Map<string, typeof fundamentalData.$inferSelect>();
    
    // 首先找到每个指标的最大日期
    const indicatorGroups = new Map<string, typeof fundamentalData.$inferSelect[]>();
    for (const item of allData) {
      const key = `${item.dataType}:${item.indicator}`;
      if (!indicatorGroups.has(key)) {
        indicatorGroups.set(key, []);
      }
      indicatorGroups.get(key)!.push(item);
    }

    // 对每个指标组，只保留日期最新的记录，原样展示名称
    for (const [key, items] of indicatorGroups.entries()) {
      if (items.length === 0) continue;
      
      const maxDate = new Date(Math.max(...items.map(i => i.releaseDate?.getTime() || 0)));
      
      const latestItem = items
        .filter(i => i.releaseDate?.getTime() === maxDate.getTime())
        .sort((a, b) => (b.id || 0) - (a.id || 0))[0];
      
      if (latestItem) {
        latestMap.set(key, latestItem);
      }
    }

    const result = Array.from(latestMap.values());
    return result.slice(offset, offset + limit);
  } catch (error) {
    console.error("[Database] Failed to get latest fundamental data:", error);
    return [];
  }
}

export async function createFundamentalData(data: typeof fundamentalData.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // 根据 indicator, dataType 和 source 唯一标识一个指标
    const existing = await db
      .select()
      .from(fundamentalData)
      .where(
        and(
          eq(fundamentalData.indicator, data.indicator),
          eq(fundamentalData.dataType, data.dataType),
          eq(fundamentalData.source, data.source || "LocalPush")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return await db
        .update(fundamentalData)
        .set({
          value: data.value ?? null,
          unit: data.unit,
          releaseDate: data.releaseDate,
          description: data.description,
          updatedAt: new Date(),
        })
        .where(eq(fundamentalData.id, existing[0].id));
    } else {
      return await db.insert(fundamentalData).values(data);
    }
  } catch (error) {
    console.error(`[Database] Failed to upsert fundamental data for ${data.indicator}:`, error);
    throw error;
  }
}

// ============ External Views ============
export async function getExternalViews(limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(externalViews)
    .orderBy(desc(externalViews.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createExternalView(view: typeof externalViews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(externalViews).values(view);
}

// ============ View Conclusions ============
export async function getViewConclusions(viewId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(viewConclusions)
    .where(eq(viewConclusions.viewId, viewId));
}

export async function createViewConclusion(conclusion: typeof viewConclusions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(viewConclusions).values(conclusion);
}

// ============ Trade Records ============
export async function getTradeRecords(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tradeRecords)
    .where(eq(tradeRecords.userId, userId))
    .orderBy(desc(tradeRecords.tradeDate))
    .limit(limit)
    .offset(offset);
}

export async function createTradeRecord(record: typeof tradeRecords.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(tradeRecords).values(record);
}

// ============ Trade Reviews ============
export async function getTradeReviews(recordId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tradeReviews)
    .where(eq(tradeReviews.recordId, recordId));
}

export async function createTradeReview(review: typeof tradeReviews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(tradeReviews).values(review);
}

// ============ Dashboard Configs ============
export async function getDashboardConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(dashboardConfigs)
    .where(eq(dashboardConfigs.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertDashboardConfig(config: typeof dashboardConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getDashboardConfig(config.userId!);
  if (existing) {
    return await db
      .update(dashboardConfigs)
      .set({
        layout: config.layout,
        visibleWidgets: config.visibleWidgets,
        updatedAt: new Date(),
      })
      .where(eq(dashboardConfigs.id, existing.id));
  } else {
    return await db.insert(dashboardConfigs).values(config);
  }
}

// ============ Weekly Flame Reports ============
export async function getWeeklyFlameReports(limit = 10, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(weeklyFlameReports)
    .orderBy(desc(weeklyFlameReports.reportDate))
    .limit(limit)
    .offset(offset);
}

export async function createWeeklyFlameReport(report: typeof weeklyFlameReports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(weeklyFlameReports).values(report);
}

// ============ TQ Configs ============
export async function getTqConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(tqConfigs)
    .where(eq(tqConfigs.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertTqConfig(config: typeof tqConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getTqConfig(config.userId!);
  if (existing) {
    return await db
      .update(tqConfigs)
      .set({
        tqAccount: config.tqAccount,
        tqPassword: config.tqPassword,
        updatedAt: new Date(),
      })
      .where(eq(tqConfigs.id, existing.id));
  } else {
    return await db.insert(tqConfigs).values(config);
  }
}

// ============ Indicators ============
export async function getIndicators() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(indicators);
}

// ============ Signal Records ============
export async function getSignalRecords(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(signalRecords)
    .where(eq(signalRecords.userId, userId))
    .orderBy(desc(signalRecords.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createSignalRecord(record: typeof signalRecords.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(signalRecords).values(record);
}

// ============ Email Configs ============
export async function getEmailConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(emailConfigs)
    .where(eq(emailConfigs.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertEmailConfig(config: typeof emailConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getEmailConfig(config.userId!);
  if (existing) {
    return await db
      .update(emailConfigs)
      .set({
        email: config.email,
        password: config.password,
        imapServer: config.imapServer,
        imapPort: config.imapPort,
        updatedAt: new Date(),
      })
      .where(eq(emailConfigs.id, existing.id));
  } else {
    return await db.insert(emailConfigs).values(config);
  }
}

// ============ Kline Cache ============
export async function getKlineCache(symbol: string, duration: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(klineCache)
    .where(and(eq(klineCache.symbol, symbol), eq(klineCache.duration, duration)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertKlineCache(cache: typeof klineCache.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getKlineCache(cache.symbol!, cache.duration!);
  if (existing) {
    return await db
      .update(klineCache)
      .set({
        data: cache.data,
        updatedAt: new Date(),
      })
      .where(eq(klineCache.id, existing.id));
  } else {
    return await db.insert(klineCache).values(cache);
  }
}

// ============ AI Analyst Configs ============
export async function getAiAnalystConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(aiAnalystConfigs)
    .where(eq(aiAnalystConfigs.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertAiAnalystConfig(config: typeof aiAnalystConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getAiAnalystConfig(config.userId!);
  if (existing) {
    return await db
      .update(aiAnalystConfigs)
      .set({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        updatedAt: new Date(),
      })
      .where(eq(aiAnalystConfigs.id, existing.id));
  } else {
    return await db.insert(aiAnalystConfigs).values(config);
  }
}

// ============ AI Analyst Reports ============
export async function getAiAnalystReports(userId: number, limit = 10, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(aiAnalystReports)
    .where(eq(aiAnalystReports.userId, userId))
    .orderBy(desc(aiAnalystReports.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createAiAnalystReport(report: typeof aiAnalystReports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(aiAnalystReports).values(report);
}
