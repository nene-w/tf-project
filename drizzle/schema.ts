import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  bigint,
  float,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with treasury trading specific fields.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 邮件交易信号表
 * 存储从邮件中解析出的交易信号
 */
export const emailSignals = mysqlTable("email_signals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 信号类型：买入、卖出、观望等
  signalType: mysqlEnum("signalType", ["buy", "sell", "hold", "unknown"]).notNull(),
  // 合约品种（如 T2406、T2409 等）
  contract: varchar("contract", { length: 50 }).notNull(),
  // 建议价格
  price: decimal("price", { precision: 10, scale: 4 }),
  // 信号来源邮件主题
  emailSubject: text("emailSubject"),
  // 信号来源邮件内容摘要
  emailContent: text("emailContent"),
  // 信号发出时间
  signalTime: timestamp("signalTime"),
  // 信号置信度（0-100）
  confidence: int("confidence").default(50),
  // 信号状态：待处理、已执行、已过期等
  status: mysqlEnum("status", ["pending", "executed", "expired", "cancelled"]).default("pending"),
  // 用户对该信号的备注
  userNotes: text("userNotes"),
  // 信号的原始邮件 ID（用于追踪）
  emailId: varchar("emailId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailSignal = typeof emailSignals.$inferSelect;
export type InsertEmailSignal = typeof emailSignals.$inferInsert;

/**
 * 国债基本面数据表
 * 存储利率、经济指标、政策等基本面信息
 */
export const fundamentalData = mysqlTable("fundamental_data", {
  id: int("id").autoincrement().primaryKey(),
  // 数据类型：利率、GDP、CPI、政策等
  dataType: varchar("dataType", { length: 100 }).notNull(),
  // 具体指标名称
  indicator: varchar("indicator", { length: 255 }).notNull(),
  // 数值
  value: decimal("value", { precision: 15, scale: 4 }),
  // 单位
  unit: varchar("unit", { length: 50 }),
  // 数据发布时间
  releaseDate: timestamp("releaseDate"),
  // 数据有效期
  effectiveDate: timestamp("effectiveDate"),
  // 数据来源
  source: varchar("source", { length: 255 }),
  // 数据描述
  description: text("description"),
  // 是否已用于分析
  analyzed: boolean("analyzed").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FundamentalData = typeof fundamentalData.$inferSelect;
export type InsertFundamentalData = typeof fundamentalData.$inferInsert;

/**
 * 基本面分析报告表
 * 存储 LLM 生成的基本面分析和建议
 */
export const fundamentalAnalysis = mysqlTable("fundamental_analysis", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 分析标题
  title: varchar("title", { length: 255 }).notNull(),
  // 分析内容（Markdown 格式）
  content: text("content").notNull(),
  // 交易建议
  recommendation: mysqlEnum("recommendation", ["strong_buy", "buy", "hold", "sell", "strong_sell"]).notNull(),
  // 分析涉及的关键指标（JSON 数组）
  keyIndicators: json("keyIndicators"),
  // 风险评估
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]).default("medium"),
  // 分析有效期
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FundamentalAnalysis = typeof fundamentalAnalysis.$inferSelect;
export type InsertFundamentalAnalysis = typeof fundamentalAnalysis.$inferInsert;

/**
 * 外部观点表
 * 存储从分析师、公众号等外部平台抓取的观点
 */
export const externalViews = mysqlTable("external_views", {
  id: int("id").autoincrement().primaryKey(),
  // 观点来源类型：分析师、公众号、研报等
  sourceType: varchar("sourceType", { length: 100 }).notNull(),
  // 观点来源名称
  sourceName: varchar("sourceName", { length: 255 }).notNull(),
  // 观点作者
  author: varchar("author", { length: 255 }),
  // 观点标题
  title: varchar("title", { length: 255 }).notNull(),
  // 观点内容摘要
  summary: text("summary").notNull(),
  // 观点完整内容
  fullContent: text("fullContent"),
  // 观点观看/点赞数
  engagement: int("engagement").default(0),
  // 观点发布时间
  publishDate: timestamp("publishDate"),
  // 观点链接
  url: varchar("url", { length: 500 }),
  // 观点情感倾向：看涨、看跌、中立
  sentiment: mysqlEnum("sentiment", ["bullish", "bearish", "neutral"]).default("neutral"),
  // 观点相关合约
  relatedContracts: json("relatedContracts"),
  // FLAME 维度：F, L, A, M, E
  flameDimension: varchar("flameDimension", { length: 10 }),
  // 情感评分：-5 到 +5
  sentimentScore: int("sentimentScore").default(0),
  // 预期与现实之差分析
  expectationGap: text("expectationGap"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExternalView = typeof externalViews.$inferSelect;
export type InsertExternalView = typeof externalViews.$inferInsert;

/**
 * 外部观点综合结论表
 * 存储对多个外部观点的综合分析和结论
 */
export const viewConclusions = mysqlTable("view_conclusions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 结论标题
  title: varchar("title", { length: 255 }).notNull(),
  // 综合结论内容
  conclusion: text("conclusion").notNull(),
  // 包含的外部观点 ID（JSON 数组）
  viewIds: json("viewIds"),
  // 综合观点倾向
  overallSentiment: mysqlEnum("overallSentiment", ["bullish", "bearish", "neutral"]).default("neutral"),
  // 观点一致性评分（0-100）
  consensusScore: int("consensusScore").default(50),
  // 分析有效期
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ViewConclusion = typeof viewConclusions.$inferSelect;
export type InsertViewConclusion = typeof viewConclusions.$inferInsert;

/**
 * 交易记录表
 * 存储用户的真实交易数据
 */
export const tradeRecords = mysqlTable("trade_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 合约品种
  contract: varchar("contract", { length: 50 }).notNull(),
  // 交易方向：买入、卖出
  direction: mysqlEnum("direction", ["long", "short"]).notNull(),
  // 开仓价格
  entryPrice: decimal("entryPrice", { precision: 10, scale: 4 }).notNull(),
  // 开仓时间
  entryTime: timestamp("entryTime").notNull(),
  // 平仓价格
  exitPrice: decimal("exitPrice", { precision: 10, scale: 4 }),
  // 平仓时间
  exitTime: timestamp("exitTime"),
  // 交易手数
  quantity: int("quantity").notNull(),
  // 盈亏（单位：点或元）
  profitLoss: decimal("profitLoss", { precision: 15, scale: 4 }),
  // 盈亏率（百分比）
  profitLossRate: decimal("profitLossRate", { precision: 5, scale: 2 }),
  // 交易状态：开仓、平仓
  status: mysqlEnum("status", ["open", "closed"]).notNull(),
  // 交易备注
  notes: text("notes"),
  // 交易相关的信号 ID（可能来自邮件或分析）
  relatedSignalId: int("relatedSignalId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TradeRecord = typeof tradeRecords.$inferSelect;
export type InsertTradeRecord = typeof tradeRecords.$inferInsert;

/**
 * 交易复盘分析表
 * 存储对单笔交易的详细复盘分析
 */
export const tradeReviews = mysqlTable("trade_reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 关联的交易记录 ID
  tradeId: int("tradeId").notNull(),
  // 复盘标题
  title: varchar("title", { length: 255 }).notNull(),
  // 交易优点分析
  strengths: text("strengths"),
  // 交易缺点分析
  weaknesses: text("weaknesses"),
  // 改进建议
  improvements: text("improvements"),
  // 整体评分（0-100）
  overallScore: int("overallScore").default(50),
  // 关键学习点
  keyLearnings: text("keyLearnings"),
  // 复盘状态：草稿、已完成
  status: mysqlEnum("status", ["draft", "completed"]).default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TradeReview = typeof tradeReviews.$inferSelect;
export type InsertTradeReview = typeof tradeReviews.$inferInsert;

/**
 * 看板配置表
 * 存储用户的个性化看板配置
 */
export const dashboardConfigs = mysqlTable("dashboard_configs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // 看板布局配置（JSON）
  layout: json("layout"),
  // 显示的小部件（JSON 数组）
  widgets: json("widgets"),
  // 默认时间范围
  defaultTimeRange: varchar("defaultTimeRange", { length: 50 }).default("7d"),
  // 是否显示风险提示
  showRiskWarning: boolean("showRiskWarning").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DashboardConfig = typeof dashboardConfigs.$inferSelect;
export type InsertDashboardConfig = typeof dashboardConfigs.$inferInsert;

/**
 * 周度 FLAME 综合报告表
 */
export const weeklyFlameReports = mysqlTable("weekly_flame_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 报告标题
  title: varchar("title", { length: 255 }).notNull(),
  // 报告开始日期
  startDate: timestamp("startDate").notNull(),
  // 报告结束日期
  endDate: timestamp("endDate").notNull(),
  // 综合分析内容（Markdown）
  content: text("content").notNull(),
  // 各维度评分汇总 (JSON)
  dimensionScores: json("dimensionScores"),
  // 核心预期差识别
  keyExpectationGaps: text("keyExpectationGaps"),
  // 包含的观点 ID (JSON)
  viewIds: json("viewIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WeeklyFlameReport = typeof weeklyFlameReports.$inferSelect;
export type InsertWeeklyFlameReport = typeof weeklyFlameReports.$inferInsert;

// 天勤量化账户配置
export const tqConfigs = mysqlTable("tq_configs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  tqUsername: varchar("tqUsername", { length: 128 }),
  tqPassword: varchar("tqPassword", { length: 256 }),
  // 订阅的合约列表，JSON数组: ["KQ.m@CFFEX.T","KQ.m@CFFEX.TF","KQ.m@CFFEX.TS","KQ.m@CFFEX.TL"]
  subscribedContracts: json("subscribedContracts").$type<string[]>(),
  // K线周期（秒）：60=1分钟, 300=5分钟, 900=15分钟, 1800=30分钟, 3600=1小时, 86400=日线
  klinePeriod: int("klinePeriod").default(60),
  isEnabled: boolean("isEnabled").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TqConfig = typeof tqConfigs.$inferSelect;
export type InsertTqConfig = typeof tqConfigs.$inferInsert;

// 通达信指标代码
export const indicators = mysqlTable("indicators", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  // 原始通达信代码
  tdxCode: text("tdxCode").notNull(),
  // 转换后的Python代码
  pythonCode: text("pythonCode"),
  // 转换状态: pending/success/error
  convertStatus: mysqlEnum("convertStatus", ["pending", "success", "error"]).default("pending"),
  convertError: text("convertError"),
  // 应用到的合约列表
  appliedContracts: json("appliedContracts").$type<string[]>(),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Indicator = typeof indicators.$inferSelect;
export type InsertIndicator = typeof indicators.$inferInsert;

// 历史信号记录
export const signalRecords = mysqlTable("signal_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  indicatorId: int("indicatorId"),
  indicatorName: varchar("indicatorName", { length: 128 }),
  contract: varchar("contract", { length: 64 }).notNull(),
  // 信号类型: buy/sell/alert
  signalType: mysqlEnum("signalType", ["buy", "sell", "alert"]).notNull(),
  price: float("price"),
  signalValue: float("signalValue"),
  description: text("description"),
  // 是否已发送邮件
  emailSent: boolean("emailSent").default(false),
  emailSentAt: timestamp("emailSentAt"),
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SignalRecord = typeof signalRecords.$inferSelect;
export type InsertSignalRecord = typeof signalRecords.$inferInsert;

// 邮件报警配置
export const emailConfigs = mysqlTable("email_configs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  smtpHost: varchar("smtpHost", { length: 256 }),
  smtpPort: int("smtpPort").default(465),
  smtpSecure: boolean("smtpSecure").default(true),
  smtpUser: varchar("smtpUser", { length: 320 }),
  smtpPassword: varchar("smtpPassword", { length: 256 }),
  fromEmail: varchar("fromEmail", { length: 320 }),
  toEmails: json("toEmails").$type<string[]>(),
  isEnabled: boolean("isEnabled").default(false),
  // 报警冷却时间（分钟），避免频繁发送
  cooldownMinutes: int("cooldownMinutes").default(30),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailConfig = typeof emailConfigs.$inferSelect;
export type InsertEmailConfig = typeof emailConfigs.$inferInsert;

// K线数据缓存
export const klineCache = mysqlTable("kline_cache", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  contract: varchar("contract", { length: 64 }).notNull(),
  period: int("period").notNull(),
  // 纳秒时间戳
  datetime: bigint("datetime", { mode: "number" }).notNull(),
  open: float("open"),
  high: float("high"),
  low: float("low"),
  close: float("close"),
  volume: float("volume"),
  openInterest: float("openInterest"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KlineCache = typeof klineCache.$inferSelect;
export type InsertKlineCache = typeof klineCache.$inferInsert;

// AI 分析师 API 配置表
export const aiAnalystConfigs = mysqlTable("ai_analyst_configs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // API 类型：openai_compatible, custom
  apiType: varchar("apiType", { length: 50 }).default("openai_compatible"),
  // API Base URL
  apiBaseUrl: varchar("apiBaseUrl", { length: 500 }),
  // API Key
  apiKey: varchar("apiKey", { length: 500 }),
  // 使用的模型名称
  modelName: varchar("modelName", { length: 100 }).default("gpt-4.1-mini"),
  // 自定义 System Prompt（可选）
  systemPrompt: text("systemPrompt"),
  // 温度参数
  temperature: float("temperature").default(0.7),
  // 最大 token 数
  maxTokens: int("maxTokens").default(4000),
  // 是否启用
  isEnabled: boolean("isEnabled").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiAnalystConfig = typeof aiAnalystConfigs.$inferSelect;
export type InsertAiAnalystConfig = typeof aiAnalystConfigs.$inferInsert;

// AI 分析师报告表
export const aiAnalystReports = mysqlTable("ai_analyst_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 报告标题
  title: varchar("title", { length: 255 }).notNull(),
  // 分析的合约品种：TF(5年期), T(10年期), TL(30年期)
  contract: varchar("contract", { length: 10 }).notNull(),
  // 报告完整内容（Markdown）
  content: text("content").notNull(),
  // 趋势结论：bullish, bearish, neutral
  trendConclusion: mysqlEnum("trendConclusion", ["bullish", "bearish", "neutral"]).notNull(),
  // 置信度评分 (0-100)
  confidenceScore: int("confidenceScore").default(50),
  // FLAME 基本面评分汇总 (JSON)
  flameScores: json("flameScores"),
  // 技术形态分析摘要
  technicalSummary: text("technicalSummary"),
  // 关键支撑位
  supportLevels: json("supportLevels").$type<number[]>(),
  // 关键压力位
  resistanceLevels: json("resistanceLevels").$type<number[]>(),
  // 市场预期差核心点
  expectationGaps: text("expectationGaps"),
  // 报告生成时使用的数据源 ID (JSON)
  dataSources: json("dataSources"),
  // 报告有效期
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiAnalystReport = typeof aiAnalystReports.$inferSelect;
export type InsertAiAnalystReport = typeof aiAnalystReports.$inferInsert;
