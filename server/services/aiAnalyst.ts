// 使用内置 LLM 接口，无需安装 openai 包
import { invokeLLM } from "../_core/llm";

// 合约信息映射
export const CONTRACT_INFO = {
  TF: { name: "5年期国债期货", code: "TF", tqCode: "KQ.m@CFFEX.TF" },
  T: { name: "10年期国债期货", code: "T", tqCode: "KQ.m@CFFEX.T" },
  TL: { name: "30年期国债期货", code: "TL", tqCode: "KQ.m@CFFEX.TL" },
};

export type ContractCode = keyof typeof CONTRACT_INFO;

// AI 分析师配置
export interface AiAnalystConfig {
  apiBaseUrl?: string;
  apiKey: string;
  modelName: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

// 分析输入数据
export interface AnalystInputData {
  contract: ContractCode;
  // FLAME 维度数据
  flameData: {
    fundamentalAnalysis?: string; // 最新基本面分析报告
    weeklyFlameReport?: string;   // 最新周度 FLAME 报告
    externalViews?: Array<{       // 最近外部观点
      title: string;
      summary: string;
      flameDimension?: string;
      sentimentScore?: number;
      expectationGap?: string;
      publishDate?: string;
    }>;
  };
  // 技术形态数据
  technicalData: {
    currentPrice?: number;
    change?: number;
    changePercent?: number;
    volume?: number;
    openInterest?: number;
    // K 线统计
    high52w?: number;
    low52w?: number;
    ma5?: number;
    ma10?: number;
    ma20?: number;
    ma60?: number;
    // 最近 K 线数据（最多 20 根）
    recentKlines?: Array<{
      datetime: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  };
  // 信号数据
  signalData?: Array<{
    indicatorName: string;
    signalType: string;
    price?: number;
    triggeredAt: string;
  }>;
}

// 分析结果
export interface AnalystResult {
  title: string;
  content: string;
  trendConclusion: "bullish" | "bearish" | "neutral";
  confidenceScore: number;
  flameScores: Record<string, number>;
  technicalSummary: string;
  supportLevels: number[];
  resistanceLevels: number[];
  expectationGaps: string;
}

/**
 * 构建 AI 分析师的系统提示词
 */
function buildSystemPrompt(customPrompt?: string): string {
  const defaultPrompt = `你是一位专业的国债期货量化分析师，拥有深厚的固定收益市场研究经验。
你的分析框架基于 FLAME 五维模型：
- F (Fundamental/基本面)：经济数据、通胀、增长预期
- L (Liquidity/流动性)：央行政策、资金面、利率走廊
- A (Allocation/供需)：债券供给、机构配置需求、外资动向
- M (Momentum/情绪)：市场情绪、持仓结构、技术动能
- E (External/外部环境)：地缘政治、汇率、海外利率联动

你的分析风格：
1. 重点关注"预期与现实之差"，而非仅描述当前状态
2. 区分短期扰动与中期趋势
3. 给出明确的多空判断和置信度
4. 识别关键的支撑位和压力位
5. 语言简洁专业，结论清晰可操作

输出格式要求：使用 Markdown 格式，结构清晰，包含各维度分析和最终结论。`;

  return customPrompt || defaultPrompt;
}

/**
 * 构建分析请求的用户提示词
 */
function buildUserPrompt(data: AnalystInputData): string {
  const contractInfo = CONTRACT_INFO[data.contract];
  const now = new Date().toLocaleDateString("zh-CN");

  let prompt = `请对 **${contractInfo.name}（${contractInfo.code}）** 进行综合趋势分析。
分析日期：${now}

## 一、技术形态数据
`;

  if (data.technicalData.currentPrice) {
    prompt += `
- 当前价格：${data.technicalData.currentPrice?.toFixed(3)}
- 涨跌：${data.technicalData.change?.toFixed(3)} (${data.technicalData.changePercent?.toFixed(2)}%)
- 成交量：${data.technicalData.volume?.toLocaleString()}
- 持仓量：${data.technicalData.openInterest?.toLocaleString()}
- MA5：${data.technicalData.ma5?.toFixed(3)}
- MA10：${data.technicalData.ma10?.toFixed(3)}
- MA20：${data.technicalData.ma20?.toFixed(3)}
- MA60：${data.technicalData.ma60?.toFixed(3)}
`;
  } else {
    prompt += `\n（暂无实时行情数据，请基于基本面和外部观点进行分析）\n`;
  }

  if (data.technicalData.recentKlines && data.technicalData.recentKlines.length > 0) {
    const klines = data.technicalData.recentKlines.slice(-10);
    prompt += `\n最近10根K线（日线）：\n`;
    klines.forEach(k => {
      prompt += `  ${k.datetime}: 开${k.open.toFixed(3)} 高${k.high.toFixed(3)} 低${k.low.toFixed(3)} 收${k.close.toFixed(3)} 量${k.volume}\n`;
    });
  }

  prompt += `\n## 二、FLAME 基本面数据\n`;

  if (data.flameData.fundamentalAnalysis) {
    prompt += `\n### 最新基本面分析报告摘要：\n${data.flameData.fundamentalAnalysis.slice(0, 1500)}\n`;
  }

  if (data.flameData.weeklyFlameReport) {
    prompt += `\n### 最新周度 FLAME 综合报告：\n${data.flameData.weeklyFlameReport.slice(0, 1500)}\n`;
  }

  if (data.flameData.externalViews && data.flameData.externalViews.length > 0) {
    prompt += `\n### 近期外部观点（共 ${data.flameData.externalViews.length} 篇）：\n`;
    data.flameData.externalViews.slice(0, 8).forEach((view, i) => {
      prompt += `\n**[${i + 1}] ${view.title}**`;
      if (view.flameDimension) prompt += ` [FLAME-${view.flameDimension}]`;
      if (view.sentimentScore !== undefined) prompt += ` 评分:${view.sentimentScore > 0 ? "+" : ""}${view.sentimentScore}`;
      prompt += `\n摘要：${view.summary.slice(0, 300)}`;
      if (view.expectationGap) prompt += `\n预期差：${view.expectationGap.slice(0, 200)}`;
      prompt += "\n";
    });
  }

  if (data.signalData && data.signalData.length > 0) {
    prompt += `\n## 三、近期技术信号\n`;
    data.signalData.slice(0, 5).forEach(sig => {
      prompt += `- ${sig.triggeredAt}: ${sig.indicatorName} 触发 **${sig.signalType === "buy" ? "买入" : sig.signalType === "sell" ? "卖出" : "告警"}** 信号${sig.price ? `，价格 ${sig.price.toFixed(3)}` : ""}\n`;
    });
  }

  prompt += `
## 请按以下结构输出分析报告：

### 一、FLAME 五维评分
（对每个维度给出 -5 到 +5 的评分，+为看多，-为看空，并简要说明理由）

| 维度 | 评分 | 核心判断 |
|------|------|----------|
| F - 基本面 | | |
| L - 流动性 | | |
| A - 供需结构 | | |
| M - 市场情绪 | | |
| E - 外部环境 | | |

### 二、技术形态分析
（分析当前趋势、关键均线位置、量价关系，识别形态特征）

### 三、市场预期差分析
（重点：当前市场预期是什么？实际数据/情况与预期有何背离？这种背离如何影响价格？）

### 四、关键价位
- **支撑位**：（列出2-3个关键支撑价格）
- **压力位**：（列出2-3个关键压力价格）

### 五、趋势结论
- **方向**：看多 / 看空 / 中性
- **置信度**：XX%
- **核心逻辑**：（用2-3句话概括最核心的判断依据）
- **主要风险**：（列出1-2个可能导致判断失效的风险因素）
`;

  return prompt;
}

/**
 * 从 AI 输出中解析结构化数据
 */
function parseAnalystOutput(content: string, contract: ContractCode): Omit<AnalystResult, "content"> {
  const contractInfo = CONTRACT_INFO[contract];
  const title = `${contractInfo.name} AI 综合趋势分析 - ${new Date().toLocaleDateString("zh-CN")}`;

  // 解析趋势结论
  let trendConclusion: "bullish" | "bearish" | "neutral" = "neutral";
  if (content.includes("看多") || content.includes("做多") || content.includes("偏多")) {
    trendConclusion = "bullish";
  } else if (content.includes("看空") || content.includes("做空") || content.includes("偏空")) {
    trendConclusion = "bearish";
  }

  // 解析置信度
  let confidenceScore = 60;
  const confidenceMatch = content.match(/置信度[：:]\s*(\d+)%/);
  if (confidenceMatch) {
    confidenceScore = parseInt(confidenceMatch[1]);
  }

  // 解析 FLAME 评分
  const flameScores: Record<string, number> = {};
  const flamePattern = /\|\s*[FLAME]\s*[-–]\s*([^\|]+)\s*\|\s*([+-]?\d+)\s*\|/g;
  let match;
  while ((match = flamePattern.exec(content)) !== null) {
    const dimension = match[1].trim().charAt(0).toUpperCase();
    const score = parseInt(match[2]);
    if (!isNaN(score)) {
      flameScores[dimension] = score;
    }
  }

  // 解析支撑位和压力位
  const supportLevels: number[] = [];
  const resistanceLevels: number[] = [];

  const supportMatch = content.match(/支撑位[：:][^\n]*?([\d.]+)[^\n]*/);
  if (supportMatch) {
    const prices = supportMatch[0].match(/\d{2,3}\.\d{2,4}/g);
    if (prices) supportLevels.push(...prices.slice(0, 3).map(Number));
  }

  const resistanceMatch = content.match(/压力位[：:][^\n]*?([\d.]+)[^\n]*/);
  if (resistanceMatch) {
    const prices = resistanceMatch[0].match(/\d{2,3}\.\d{2,4}/g);
    if (prices) resistanceLevels.push(...prices.slice(0, 3).map(Number));
  }

  // 提取技术分析摘要
  const techSection = content.match(/技术形态分析[\s\S]*?(?=###|$)/);
  const technicalSummary = techSection ? techSection[0].replace(/^#+\s*技术形态分析\s*/, "").trim().slice(0, 500) : "";

  // 提取预期差分析
  const gapSection = content.match(/市场预期差分析[\s\S]*?(?=###|$)/);
  const expectationGaps = gapSection ? gapSection[0].replace(/^#+\s*市场预期差分析\s*/, "").trim().slice(0, 500) : "";

  return {
    title,
    trendConclusion,
    confidenceScore,
    flameScores,
    technicalSummary,
    supportLevels,
    resistanceLevels,
    expectationGaps,
  };
}

/**
 * 调用 AI 分析师生成报告
 */
export async function generateAnalystReport(
  config: AiAnalystConfig,
  data: AnalystInputData
): Promise<AnalystResult> {
  const systemPrompt = buildSystemPrompt(config.systemPrompt);
  const userPrompt = buildUserPrompt(data);

  // 使用内置 invokeLLM 接口
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = response.choices[0]?.message?.content;
  const content = typeof rawContent === 'string' ? rawContent : (rawContent ? JSON.stringify(rawContent) : "");
  const parsed = parseAnalystOutput(content, data.contract);

  return {
    ...parsed,
    content,
  };
}

/**
 * 使用内置 API（Forge）生成报告（作为用户未配置时的降级方案）
 */
export async function generateAnalystReportWithBuiltIn(
  data: AnalystInputData
): Promise<AnalystResult> {
  const { ENV } = await import("../_core/env.js");
  const config: AiAnalystConfig = {
    apiKey: ENV.forgeApiKey,
    apiBaseUrl: ENV.forgeApiUrl,
    modelName: "gpt-4.1-mini",
    temperature: 0.7,
    maxTokens: 4000,
  };
  return generateAnalystReport(config, data);
}
