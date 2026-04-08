import { eq, desc, and, gte, lte } from "drizzle-orm";
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
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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

  // 优化查询逻辑：对于每个 indicator，只返回 releaseDate 最新的那条记录
  // 这样可以从根本上解决“旧数据还在”的问题，即使数据库中有重复记录
  try {
    let query = db
      .select()
      .from(fundamentalData);

    if (dataType) {
      query = query.where(eq(fundamentalData.dataType, dataType)) as any;
    }

    const allData = await query.orderBy(desc(fundamentalData.releaseDate));

    // 在内存中进行去重，保留每个 indicator 的最新记录
    const latestMap = new Map<string, typeof fundamentalData.$inferSelect>();
    for (const item of allData) {
      const key = `${item.dataType}:${item.indicator}`;
      if (!latestMap.has(key)) {
        latestMap.set(key, item);
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

  // 使用 upsert 逻辑：根据 indicator 和 dataType 唯一标识一个指标，如果已存在则更新，不存在则插入
  // 注意：这里假设数据库中 indicator 和 dataType 的组合是唯一的，或者我们手动处理覆盖逻辑
  try {
    // 先尝试查找是否已存在该指标
    const existing = await db
      .select()
      .from(fundamentalData)
      .where(
        and(
          eq(fundamentalData.indicator, data.indicator),
          eq(fundamentalData.dataType, data.dataType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // 如果存在，则更新
      return await db
        .update(fundamentalData)
        .set({
          value: data.value,
          unit: data.unit,
          releaseDate: data.releaseDate,
          source: data.source,
          description: data.description,
          updatedAt: new Date(),
        })
        .where(eq(fundamentalData.id, existing[0].id));
    } else {
      // 如果不存在，则插入
      return await db.insert(fundamentalData).values(data);
    }
  } catch (error) {
    console.error(`[Database] Failed to upsert fundamental data for ${data.indicator}:`, error);
    throw error;
  }
}

// ============ External Views ============
export async function getExternalViews(limit = 30, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(externalViews)
    .orderBy(desc(externalViews.publishDate))
    .limit(limit)
    .offset(offset);
}

export async function createExternalView(view: typeof externalViews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Insert the view
  await db.insert(externalViews).values(view);
  
  // Fetch and return the most recently inserted record for this view
  const insertedView = await db
    .select()
    .from(externalViews)
    .where(eq(externalViews.title, view.title || ""))
    .orderBy(desc(externalViews.id))
    .limit(1);
  
  return insertedView[0];
}

// ============ View Conclusions ============
export async function getViewConclusions(userId: number, limit = 10, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(viewConclusions)
    .where(eq(viewConclusions.userId, userId))
    .orderBy(desc(viewConclusions.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createViewConclusion(
  conclusion: typeof viewConclusions.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(viewConclusions).values(conclusion);
}

export async function getWeeklyViews(userId: number, days = 7) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await db
    .select()
    .from(externalViews)
    .where(gte(externalViews.createdAt, startDate))
    .orderBy(desc(externalViews.createdAt));
}

export async function createWeeklyFlameReport(report: typeof weeklyFlameReports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(weeklyFlameReports).values(report);
}

export async function getWeeklyFlameReports(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(weeklyFlameReports)
    .where(eq(weeklyFlameReports.userId, userId))
    .orderBy(desc(weeklyFlameReports.createdAt))
    .limit(limit);
}

// ============ Trade Records ============
export async function getTradeRecords(userId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tradeRecords)
    .where(eq(tradeRecords.userId, userId))
    .orderBy(desc(tradeRecords.entryTime))
    .limit(limit)
    .offset(offset);
}

export async function getOpenTrades(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tradeRecords)
    .where(
      and(
        eq(tradeRecords.userId, userId),
        eq(tradeRecords.status, "open")
      )
    )
    .orderBy(desc(tradeRecords.entryTime));
}

export async function createTradeRecord(record: typeof tradeRecords.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(tradeRecords).values(record);
}

export async function updateTradeRecord(
  id: number,
  updates: Partial<typeof tradeRecords.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(tradeRecords).set(updates).where(eq(tradeRecords.id, id));
}

// ============ Trade Reviews ============
export async function getTradeReviews(userId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tradeReviews)
    .where(eq(tradeReviews.userId, userId))
    .orderBy(desc(tradeReviews.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getTradeReviewByTradeId(tradeId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(tradeReviews)
    .where(eq(tradeReviews.tradeId, tradeId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createTradeReview(review: typeof tradeReviews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(tradeReviews).values(review);
}

export async function updateTradeReview(
  id: number,
  updates: Partial<typeof tradeReviews.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(tradeReviews).set(updates).where(eq(tradeReviews.id, id));
}

// ============ Dashboard Config ============
export async function getDashboardConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(dashboardConfigs)
    .where(eq(dashboardConfigs.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createOrUpdateDashboardConfig(
  config: typeof dashboardConfigs.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .insert(dashboardConfigs)
    .values(config)
    .onDuplicateKeyUpdate({
      set: {
        layout: config.layout,
        widgets: config.widgets,
        defaultTimeRange: config.defaultTimeRange,
        showRiskWarning: config.showRiskWarning,
      },
    });
}

// ============ Statistics ============
export async function getTradeStatistics(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const trades = await db
    .select()
    .from(tradeRecords)
    .where(
      and(
        eq(tradeRecords.userId, userId),
        eq(tradeRecords.status, "closed")
      )
    );

  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      totalProfitLoss: 0,
      averageProfitLoss: 0,
    };
  }

  const winCount = trades.filter((t) => t.profitLoss && Number(t.profitLoss) > 0).length;
  const totalPL = trades.reduce((sum, t) => {
    const pl = t.profitLoss ? Number(t.profitLoss) : 0;
    return sum + pl;
  }, 0);

  return {
    totalTrades: trades.length,
    winRate: Math.round((winCount / trades.length) * 100),
    totalProfitLoss: totalPL,
    averageProfitLoss: totalPL / trades.length,
  };
}

// ============ TQ Config ============
export async function getTqConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(tqConfigs)
    .where(eq(tqConfigs.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createOrUpdateTqConfig(config: typeof tqConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if config already exists
  const existing = await db
    .select()
    .from(tqConfigs)
    .where(eq(tqConfigs.userId, config.userId!))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    return await db
      .update(tqConfigs)
      .set({
        tqUsername: config.tqUsername,
        tqPassword: config.tqPassword,
        subscribedContracts: config.subscribedContracts,
        klinePeriod: config.klinePeriod,
        isEnabled: config.isEnabled,
        updatedAt: new Date(),
      })
      .where(eq(tqConfigs.userId, config.userId!));
  } else {
    // Insert new
    return await db.insert(tqConfigs).values(config);
  }
}

// ============ Indicators ============
export async function getIndicators(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(indicators)
    .where(eq(indicators.userId, userId))
    .orderBy(desc(indicators.createdAt));
}

export async function createIndicator(indicator: typeof indicators.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(indicators).values(indicator);
}

export async function updateIndicator(id: number, updates: Partial<typeof indicators.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(indicators).set(updates).where(eq(indicators.id, id));
}

export async function deleteIndicator(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(indicators).where(eq(indicators.id, id));
}

// ============ Signal Records ============
export async function getSignalRecords(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(signalRecords)
    .where(eq(signalRecords.userId, userId))
    .orderBy(desc(signalRecords.triggeredAt))
    .limit(limit);
}

export async function createSignalRecord(record: typeof signalRecords.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(signalRecords).values(record);
}

// ============ Email Config ============
export async function getEmailConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(emailConfigs)
    .where(eq(emailConfigs.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createOrUpdateEmailConfig(config: typeof emailConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .insert(emailConfigs)
    .values(config)
    .onDuplicateKeyUpdate({
      set: {
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        smtpPassword: config.smtpPassword,
        fromEmail: config.fromEmail,
        toEmails: config.toEmails,
        isEnabled: config.isEnabled,
        cooldownMinutes: config.cooldownMinutes,
      },
    });
}

// ============ Kline Cache ============
export async function getKlineCache(contract: string, period: number, limit = 1000) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(klineCache)
    .where(and(eq(klineCache.contract, contract), eq(klineCache.period, period)))
    .orderBy(desc(klineCache.datetime))
    .limit(limit);  // 支持更多历史数据
}

export async function upsertKlineCache(bars: (typeof klineCache.$inferInsert)[]) {
  const db = await getDb();
  if (!db) return;

  for (const bar of bars) {
    await db.insert(klineCache).values(bar).onDuplicateKeyUpdate({
      set: {
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        openInterest: bar.openInterest,
      },
    });
  }
}

/// ============ AI Analyst Config ============
export async function getAiAnalystConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(aiAnalystConfigs)
    .where(eq(aiAnalystConfigs.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createOrUpdateAiAnalystConfig(config: typeof aiAnalystConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db
    .insert(aiAnalystConfigs)
    .values(config)
    .onDuplicateKeyUpdate({
      set: {
        apiType: config.apiType,
        apiBaseUrl: config.apiBaseUrl,
        apiKey: config.apiKey,
        modelName: config.modelName,
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        isEnabled: config.isEnabled,
      },
    });
}

// ============ AI Analyst Reports ============
export async function getAiAnalystReports(userId: number, contract?: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(aiAnalystReports.userId, userId)];
  if (contract) {
    conditions.push(eq(aiAnalystReports.contract, contract));
  }
  return await db
    .select()
    .from(aiAnalystReports)
    .where(and(...conditions))
    .orderBy(desc(aiAnalystReports.createdAt))
    .limit(limit);
}

export async function getLatestAiAnalystReport(userId: number, contract: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(aiAnalystReports)
    .where(and(eq(aiAnalystReports.userId, userId), eq(aiAnalystReports.contract, contract)))
    .orderBy(desc(aiAnalystReports.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createAiAnalystReport(report: typeof aiAnalystReports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(aiAnalystReports).values(report);
}
