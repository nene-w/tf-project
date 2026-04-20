import { eq, desc, and, gte, lte, notLike, inArray, or, like } from "drizzle-orm";
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
  if (!db) return;

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    
    textFields.forEach(field => {
      if (user[field] !== undefined) {
        values[field] = user[field] ?? null;
        updateSet[field] = user[field] ?? null;
      }
    });

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

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Fundamental Data (核心修改部分) ============

// 定义严格的本地指标白名单，任何不在名单上的旧指标将被物理屏蔽
const ALLOWED_INDICATORS = {
  macro: [
    "PPI_环比", "PMI", "PPI_当月同比", "CPI_当月同比", "CPI_环比",
    "M1_同比", "M2_同比", "社会融资规模增量_当月值", "社会融资规模增量_当月同比",
    "金融机构_人民币贷款_当月增加_住户_中长期", "金融机构_人民币贷款_当月增加_企事业单位_中长期贷款",
    "金融机构_人民币贷款_当月增加_中长期贷款", "金融机构_人民币贷款_当月增加_短期贷款",
    "金融机构_人民币贷款_当月增加_住户", "金融机构_人民币贷款_当月增加_企事业单位",
    "PPI环比(参考)", "社会融资规模" // 兼容用户截图中的名称
  ],
  liquidity: [
    "DR001", "DR007", "DR014", "DR1M", "货币投放量_逆回购",
    "逆回购_7日_回购利率", "中期借贷便利_MLF_余额", "中期借贷便利_MLF_操作金额_合计"
  ],
  external: [
    "美国_国债收益率_10年", "美国_国债收益率_2年", "美国_联邦基金利率",
    "美国_美元指数", "美国_其他指标", "人民币离岸价_USDCNH_收盘价"
  ],
  supply: [
    "中债国债到期收益率_30年", "中债国债到期收益率_10年", "中债国债到期收益率_2年",
    "中债国债到期收益率_5年", "中债_债券发行量_国债_当月值", "中债_债券发行量_地方政府债_当月值"
  ]
};

export async function getFundamentalData(dataType?: string, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  try {
    // 1. 映射分类
    let targetDataType = dataType;
    if (dataType === "F") targetDataType = "macro";
    if (dataType === "L") targetDataType = "liquidity";
    if (dataType === "A") targetDataType = "supply";
    if (dataType === "M") targetDataType = "sentiment";
    if (dataType === "E") targetDataType = "external";

    // 2. 构建查询条件：必须是 LocalPush 来源，且绝对排除那些顽固的旧指标关键词
    const conditions = [
      eq(fundamentalData.source, "LocalPush"),
      notLike(fundamentalData.indicator, "%不确定性%"),
      notLike(fundamentalData.indicator, "%地缘政治%"),
      notLike(fundamentalData.indicator, "%VIX%"),
      notLike(fundamentalData.indicator, "%黄金价格%"),
      notLike(fundamentalData.indicator, "%全球经济%"),
      notLike(fundamentalData.indicator, "%测试%")
    ];

    if (targetDataType && targetDataType !== "all") {
      // 兼容前端可能发送的 bond_market 分类
      const finalType = targetDataType === "bond_market" ? "supply" : targetDataType;
      conditions.push(eq(fundamentalData.dataType, finalType));
    }

    // 3. 执行查询
    const allData = await db
      .select()
      .from(fundamentalData)
      .where(and(...conditions))
      .orderBy(desc(fundamentalData.releaseDate));

    // 4. 内存二次过滤与去重
    const latestMap = new Map<string, typeof fundamentalData.$inferSelect>();
    const indicatorGroups = new Map<string, typeof fundamentalData.$inferSelect[]>();

    for (const item of allData) {
      const indicator = item.indicator;
      const category = item.dataType as keyof typeof ALLOWED_INDICATORS;
      
      // 严格白名单校验：如果是 F/L/A/E 维度，必须在名单内；如果是 M 维度，必须以 futures 开头
      let isAllowed = false;
      if (category === "sentiment" || item.dataType === "sentiment") {
        isAllowed = indicator.toLowerCase().startsWith("futures");
      } else if (ALLOWED_INDICATORS[category]) {
        isAllowed = ALLOWED_INDICATORS[category].some(name => indicator.includes(name));
      } else {
        // 如果没有指定分类，只要在任何一个白名单里就算通过
        isAllowed = Object.values(ALLOWED_INDICATORS).flat().some(name => indicator.includes(name)) || 
                    indicator.toLowerCase().startsWith("futures");
      }

      if (!isAllowed) continue;

      const key = `${item.dataType}:${indicator}`;
      if (!indicatorGroups.has(key)) indicatorGroups.set(key, []);
      indicatorGroups.get(key)!.push(item);
    }

    // 5. 只保留每个指标的最新日期数据
    for (const [key, items] of indicatorGroups.entries()) {
      if (items.length === 0) continue;
      const maxDate = new Date(Math.max(...items.map(i => i.releaseDate?.getTime() || 0)));
      const latestItem = items
        .filter(i => i.releaseDate?.getTime() === maxDate.getTime())
        .sort((a, b) => (b.id || 0) - (a.id || 0))[0];
      if (latestItem) latestMap.set(key, latestItem);
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
    // 强制标记为 LocalPush，确保只有通过此接口进入的数据能被显示
    const finalData = { ...data, source: "LocalPush" };
    
    const existing = await db
      .select()
      .from(fundamentalData)
      .where(
        and(
          eq(fundamentalData.indicator, finalData.indicator),
          eq(fundamentalData.dataType, finalData.dataType),
          eq(fundamentalData.source, "LocalPush")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return await db
        .update(fundamentalData)
        .set({
          value: finalData.value ?? null,
          unit: finalData.unit,
          releaseDate: finalData.releaseDate,
          description: finalData.description,
          updatedAt: new Date(),
        })
        .where(eq(fundamentalData.id, existing[0].id));
    } else {
      return await db.insert(fundamentalData).values(finalData);
    }
  } catch (error) {
    console.error(`[Database] Failed to upsert fundamental data for ${data.indicator}:`, error);
    throw error;
  }
}

// ============ 其余函数保持不变 ============
export async function getEmailSignals(userId: number, limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(emailSignals).where(eq(emailSignals.userId, userId)).orderBy(desc(emailSignals.createdAt)).limit(limit).offset(offset);
}
export async function createEmailSignal(signal: typeof emailSignals.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(emailSignals).values(signal);
}
export async function updateEmailSignal(id: number, updates: Partial<typeof emailSignals.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(emailSignals).set(updates).where(eq(emailSignals.id, id));
}
export async function getFundamentalAnalysis(userId: number, limit = 10, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fundamentalAnalysis).where(eq(fundamentalAnalysis.userId, userId)).orderBy(desc(fundamentalAnalysis.createdAt)).limit(limit).offset(offset);
}
export async function createFundamentalAnalysis(analysis: typeof fundamentalAnalysis.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(fundamentalAnalysis).values(analysis);
}
export async function getExternalViews(limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(externalViews).orderBy(desc(externalViews.createdAt)).limit(limit).offset(offset);
}
export async function createExternalView(view: typeof externalViews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(externalViews).values(view);
}
export async function getViewConclusions(viewId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(viewConclusions).where(eq(viewConclusions.viewId, viewId));
}
export async function createViewConclusion(conclusion: typeof viewConclusions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(viewConclusions).values(conclusion);
}
export async function getTradeRecords(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tradeRecords).where(eq(tradeRecords.userId, userId)).orderBy(desc(tradeRecords.tradeDate)).limit(limit).offset(offset);
}
export async function createTradeRecord(record: typeof tradeRecords.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(tradeRecords).values(record);
}
export async function getTradeReviews(recordId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tradeReviews).where(eq(tradeReviews.recordId, recordId));
}
export async function createTradeReview(review: typeof tradeReviews.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(tradeReviews).values(review);
}
export async function getDashboardConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dashboardConfigs).where(eq(dashboardConfigs.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
export async function createOrUpdateDashboardConfig(config: typeof dashboardConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(dashboardConfigs).values(config).onDuplicateKeyUpdate({ set: config });
}
export async function getTradeStatistics(userId: number) {
  const db = await getDb();
  if (!db) return { totalTrades: 0, winRate: 0, profitFactor: 0 };
  const records = await db.select().from(tradeRecords).where(eq(tradeRecords.userId, userId));
  const totalTrades = records.length;
  const winningTrades = records.filter(r => (parseFloat(r.pnl || "0")) > 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  return { totalTrades, winRate, profitFactor: 1.5 };
}
export async function getWeeklyViews() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(externalViews).orderBy(desc(externalViews.createdAt)).limit(5);
}
export async function createWeeklyFlameReport(report: typeof weeklyFlameReports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(weeklyFlameReports).values(report);
}
export async function getWeeklyFlameReports(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(weeklyFlameReports).orderBy(desc(weeklyFlameReports.createdAt)).limit(limit);
}
export async function getTqConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tqConfigs).where(eq(tqConfigs.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
export async function createOrUpdateTqConfig(config: typeof tqConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(tqConfigs).values(config).onDuplicateKeyUpdate({ set: config });
}
export async function getIndicators(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(indicators).where(eq(indicators.userId, userId));
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
export async function getSignalRecords(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(signalRecords).where(eq(signalRecords.userId, userId)).orderBy(desc(signalRecords.createdAt)).limit(limit);
}
export async function createSignalRecord(record: typeof signalRecords.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(signalRecords).values(record);
}
export async function getEmailConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailConfigs).where(eq(emailConfigs.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
export async function createOrUpdateEmailConfig(config: typeof emailConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(emailConfigs).values(config).onDuplicateKeyUpdate({ set: config });
}
export async function getKlineCache(symbol: string, interval: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(klineCache).where(and(eq(klineCache.symbol, symbol), eq(klineCache.interval, interval))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
export async function upsertKlineCache(cache: typeof klineCache.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(klineCache).values(cache).onDuplicateKeyUpdate({ set: cache });
}
export async function getAiAnalystConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiAnalystConfigs).where(eq(aiAnalystConfigs.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
export async function createOrUpdateAiAnalystConfig(config: typeof aiAnalystConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(aiAnalystConfigs).values(config).onDuplicateKeyUpdate({ set: config });
}
export async function getAiAnalystReports(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(aiAnalystReports).where(eq(aiAnalystReports.userId, userId)).orderBy(desc(aiAnalystReports.createdAt)).limit(limit);
}
export async function getLatestAiAnalystReport(userId: number, contractCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiAnalystReports).where(and(eq(aiAnalystReports.userId, userId), eq(aiAnalystReports.contractCode, contractCode))).orderBy(desc(aiAnalystReports.createdAt)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
export async function createAiAnalystReport(report: typeof aiAnalystReports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(aiAnalystReports).values(report);
}
export async function getTradeReviewByTradeId(tradeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tradeReviews).where(eq(tradeReviews.recordId, tradeId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
export async function getOpenTrades(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(tradeRecords).where(and(eq(tradeRecords.userId, userId), eq(tradeRecords.status, "open")));
}
