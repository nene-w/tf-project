import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getEmailSignals,
  createEmailSignal,
  updateEmailSignal,
  getFundamentalAnalysis,
  createFundamentalAnalysis,
  getFundamentalData,
  createFundamentalData,
  getExternalViews,
  createExternalView,
  getViewConclusions,
  createViewConclusion,
  getTradeRecords,
  getOpenTrades,
  createTradeRecord,
  updateTradeRecord,
  getTradeReviews,
  getTradeReviewByTradeId,
  createTradeReview,
  updateTradeReview,
  getDashboardConfig,
  createOrUpdateDashboardConfig,
  getTradeStatistics,
  getWeeklyViews,
  createWeeklyFlameReport,
  getWeeklyFlameReports,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { fetchEmailSignals, startEmailPolling } from "./emailService";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ Email Signals ============
  emailSignals: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        return await getEmailSignals(ctx.user.id, input.limit, input.offset);
      }),

    create: protectedProcedure
      .input(
        z.object({
          signalType: z.enum(["buy", "sell", "hold", "unknown"]),
          contract: z.string(),
          price: z.number().optional(),
          emailSubject: z.string().optional(),
          emailContent: z.string().optional(),
          signalTime: z.date().optional(),
          confidence: z.number().optional(),
          emailId: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await createEmailSignal({
          userId: ctx.user.id,
          signalType: input.signalType,
          contract: input.contract,
          price: input.price ? String(input.price) : undefined,
          emailSubject: input.emailSubject,
          emailContent: input.emailContent,
          signalTime: input.signalTime,
          confidence: input.confidence,
          emailId: input.emailId,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "executed", "expired", "cancelled"]).optional(),
          userNotes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await updateEmailSignal(input.id, {
          status: input.status,
          userNotes: input.userNotes,
        });
      }),

    fetchFromEmail: protectedProcedure
      .mutation(async ({ ctx }) => {
        const signals = await fetchEmailSignals();
        let newSignals = 0;

        for (const signal of signals) {
          const existing = await getEmailSignals(ctx.user.id, 1000, 0);
          const isDuplicate = existing.some(
            (s) => s.emailId === signal.emailId
          );

          if (!isDuplicate) {
            await createEmailSignal({
              userId: ctx.user.id,
              signalType: signal.signalType,
              contract: signal.contract,
              price: signal.price,
              emailSubject: signal.emailSubject,
              emailContent: signal.emailContent,
              signalTime: signal.signalTime,
              confidence: signal.confidence,
              emailId: signal.emailId,
            });
            newSignals++;
          }
        }

        return { success: true, newSignals, totalSignals: signals.length };
      }),
  }),

  // ============ Fundamental Analysis ============
  fundamentalAnalysis: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(10), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        return await getFundamentalAnalysis(ctx.user.id, input.limit, input.offset);
      }),

    generateFlame: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          autoFetch: z.boolean().default(true),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // 1. 自动抓取最新数据
        if (input.autoFetch) {
          const { runFundamentalScraper } = await import('./fundamentalScraper');
          await runFundamentalScraper();
        }

        // 2. 获取最新数据上下文
        const recentData = await getFundamentalData(undefined, 20);
        const dataContext = recentData
          .map((d) => `[${d.dataType}] ${d.indicator}: ${d.value} ${d.unit || ""} (${d.source})`)
          .join("\n");

        // 3. 使用 FLAME 框架调用 LLM
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `你是一位专业的国债期货分析师。请使用财信宏观的 **FLAME 五维分析框架**，结合提供的最新市场数据，对当前利率与流动性环境进行专业机构级分析。请用中文进行深度分析。

FLAME 框架要求：
F：基本面（经济、通胀、复苏强度）
L：流动性（央行操作、DR007、资金面松紧）
A：债券供需（利率债供给、配置力量、交易盘行为）
M：市场情绪（降息预期、杠杆水平、止盈压力）
E：外部环境（美联储、中美利差、汇率）

输出格式必须包含（全部用中文）：
1. 各维度深度分析
2. 核心结论（宽松窗口是否存在）
3. 利率走势判断（震荡/趋势/区间）
4. 债券/国债期货策略建议（久期、方向、操作思路）`,
            },
            {
              role: "user",
              content: `请基于以下最新数据进行 FLAME 框架分析：\n\n${dataContext}\n\n分析标题：${input.title}\n\n请确保所有分析内容都用中文表述。`,
            },
          ],
        });

        const rawContent = response.choices[0]?.message.content;
        const content = typeof rawContent === "string" ? rawContent : "无法生成分析";

        // 4. 简单提取建议倾向（中文关键词）
        let recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell" = "hold";
        if (content.includes("强力买入") || content.includes("强烈看多") || content.includes("强烈做多")) recommendation = "strong_buy";
        else if (content.includes("买入") || content.includes("看多") || content.includes("做多")) recommendation = "buy";
        else if (content.includes("卖出") || content.includes("看空") || content.includes("做空")) recommendation = "sell";
        else if (content.includes("强力卖出") || content.includes("强烈看空")) recommendation = "strong_sell";

        // 5. 存储分析结果
        return await createFundamentalAnalysis({
          userId: ctx.user.id,
          title: input.title,
          content,
          recommendation,
          keyIndicators: recentData.map(d => d.indicator) as any,
          riskLevel: "medium",
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }),

    generate: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          keyIndicators: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const recentData = await getFundamentalData(undefined, 10);

        const dataContext = recentData
          .map((d) => `${d.indicator}: ${d.value} ${d.unit}`)
          .join("\n");

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a professional treasury futures analyst. Provide detailed fundamental analysis and trading recommendations based on the provided economic indicators.",
            },
            {
              role: "user",
              content: `Analyze the following treasury market fundamentals and provide trading recommendations:\n\n${dataContext}\n\nFocus: ${input.title}`,
            },
          ],
        });

        const rawContent = response.choices[0]?.message.content;
        const content =
          typeof rawContent === "string" ? rawContent : "Unable to generate analysis";

        let recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell" =
          "hold";
        if (content.toLowerCase().includes("strong buy")) recommendation = "strong_buy";
        else if (content.toLowerCase().includes("buy")) recommendation = "buy";
        else if (content.toLowerCase().includes("sell")) recommendation = "sell";
        else if (content.toLowerCase().includes("strong sell")) recommendation = "strong_sell";

        return await createFundamentalAnalysis({
          userId: ctx.user.id,
          title: input.title,
          content,
          recommendation,
          keyIndicators: input.keyIndicators as any,
          riskLevel: "medium",
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }),
  }),

  // ============ Fundamental Data ============
  fundamentalData: router({
    list: protectedProcedure
      .input(
        z.object({
          dataType: z.string().optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        return await getFundamentalData(input.dataType, input.limit, input.offset);
      }),

    refresh: protectedProcedure
      .mutation(async ({ ctx }) => {
        try {
          const { fetchFLAMEData } = await import('./fetch_flame_data_wrapper');
          const flameData = await fetchFLAMEData();
          
          // 存储数据到数据库
          let savedCount = 0;
          for (const item of flameData) {
            try {
              await createFundamentalData({
                dataType: item.dataType,
                indicator: item.indicator,
                value: String(item.value),
                unit: item.unit,
                releaseDate: item.releaseDate ? new Date(item.releaseDate) : new Date(),
                source: item.source,
                description: item.description,
              });
              savedCount++;
            } catch (error) {
              console.error('[FundamentalData] Error saving data:', error);
            }
          }
          
          return {
            success: true,
            dataCount: flameData.length,
            savedCount,
            message: `成功获取 ${flameData.length} 条数据，保存 ${savedCount} 条到数据库`
          };
        } catch (error) {
          console.error('[FundamentalData] Error refreshing FLAME data:', error);
          return {
            success: false,
            dataCount: 0,
            savedCount: 0,
            message: '数据刷新失败，请稍后重试'
          };
        }
      }),

    create: protectedProcedure
      .input(
        z.object({
          dataType: z.string(),
          indicator: z.string(),
          value: z.number(),
          unit: z.string().optional(),
          releaseDate: z.date().optional(),
          source: z.string().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await createFundamentalData({
          dataType: input.dataType,
          indicator: input.indicator,
          value: String(input.value),
          unit: input.unit,
          releaseDate: input.releaseDate,
          source: input.source,
          description: input.description,
        });
      }),
  }),

  // ============ External Views ============
  externalViews: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().default(30), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return await getExternalViews(input.limit, input.offset);
      }),

    fetchByUrl: protectedProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input, ctx }) => {
        const { fetchAndAnalyzeUrl } = await import("./urlScraper");
        return await fetchAndAnalyzeUrl(ctx.user.id, input.url);
      }),

    generateWeeklyFlameReport: protectedProcedure
      .mutation(async ({ ctx }) => {
        const views = await getWeeklyViews(ctx.user.id, 7);
        if (views.length === 0) {
          throw new Error("过去 7 天内没有抓取到任何外部观点，无法生成报告");
        }

        const viewsContext = views
          .map((v) => `[${v.flameDimension}] ${v.title} (评分: ${v.sentimentScore})\n摘要: ${v.summary}\n预期差: ${v.expectationGap}`)
          .join("\n---\n");

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `你是一位专业的国债期货首席分析师。请基于过去一周抓取的多篇外部观点文章，生成一份周度 FLAME 综合分析报告。
              
报告核心要求：
1. 汇总各维度的多空力量对比。
2. 重点分析“市场预期”与“现实情况”的背离点（预期差）。
3. 给出下周的交易策略建议。

输出格式要求（Markdown）：
# 周度国债期货 FLAME 综合分析报告

## 1. FLAME 维度汇总
(展示各维度的多空分布)

## 2. 核心预期差识别
(重点分析市场共识与现实的差异)

## 3. 综合研判与策略建议
(给出具体的久期、方向建议)

最后请输出一个 JSON 块（用于系统解析评分）：
{
  "dimensionScores": {"F": 0, "L": 0, "A": 0, "M": 0, "E": 0},
  "keyExpectationGaps": "总结性的预期差描述"
}`,
            },
            {
              role: "user",
              content: `以下是本周收集的外部观点数据：\n\n${viewsContext}`,
            },
          ],
        });

        const contentRaw = response.choices[0]?.message.content || "无法生成报告";
        const content = typeof contentRaw === 'string' ? contentRaw : JSON.stringify(contentRaw);
        
        // 提取 JSON
        let dimensionScores = { F: 0, L: 0, A: 0, M: 0, E: 0 };
        let keyExpectationGaps = "";
        try {
          const jsonMatch = content.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            dimensionScores = parsed.dimensionScores || dimensionScores;
            keyExpectationGaps = parsed.keyExpectationGaps || "";
          }
        } catch (e) {
          console.error("解析报告 JSON 失败", e);
        }

        return await createWeeklyFlameReport({
          userId: ctx.user.id,
          title: `周度 FLAME 分析报告 (${new Date().toLocaleDateString()})`,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          content: (typeof content === 'string' ? content : JSON.stringify(content)).replace(/\{[\s\S]*?\}/, "").trim(), // 移除 JSON 部分显示
          dimensionScores,
          keyExpectationGaps,
          viewIds: views.map(v => v.id),
        });
      }),


    submitText: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1, "标题不能为空").max(255, "标题过长"),
          content: z.string().min(10, "内容至少需要 10 个字符"),
          author: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          console.log("[submitText] Starting analysis", { title: input.title });
          
          // 调用 LLM 进行 FLAME 分析
          const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `你是一位专业的国债期货分析师。请基于用户提交的文章内容，按照 FLAME 框架进行分析。
              
分析要求：
1. 识别文章主要涉及的 FLAME 维度（F-基本面、L-流动性、A-债券供需、M-市场情绪、E-外部环境）
2. 给出情绪评分（-5 到 +5，负数表示看空，正数表示看多）
3. 提取核心预期差（市场共识与现实的差异）
4. 识别相关的国债期货合约

输出格式（JSON）：
{
  "flameDimension": "F|L|A|M|E",
  "sentimentScore": 0,
  "summary": "文章核心观点摘要",
  "expectationGap": "识别的预期差",
  "relatedContracts": ["T2406", "F2406"]
}`,
            },
            {
              role: "user",
              content: `请分析以下文章：

标题：${input.title}

内容：
${input.content}`,
            },
          ],
        });

        const contentRaw = response.choices[0]?.message.content || "{}";
        const contentStr = typeof contentRaw === 'string' ? contentRaw : JSON.stringify(contentRaw);
        
        console.log("[submitText] LLM response", { contentStr: contentStr.substring(0, 300) });
        
        let analysisData = {
          flameDimension: "F",
          sentimentScore: 0,
          summary: input.title,
          expectationGap: "",
          relatedContracts: [],
        };
        
        try {
          const jsonMatch = contentStr.match(/\{[\s\S]*?\}/);  
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            let summary = parsed.summary || input.title;
            if (typeof summary === 'string' && summary.length > 500) {
              summary = summary.substring(0, 500) + '...';
            }
            analysisData = {
              flameDimension: parsed.flameDimension || "F",
              sentimentScore: parsed.sentimentScore || 0,
              summary: summary,
              expectationGap: parsed.expectationGap || "",
              relatedContracts: parsed.relatedContracts || [],
            };
            console.log("[submitText] Analysis parsed", { summaryLen: summary.length });
          } else {
            console.warn("[submitText] No JSON found in LLM response");
          }
        } catch (e) {
          console.error("[submitText] JSON parse error", e);
          analysisData.summary = input.title;
        }

          console.log("[submitText] Analysis data", { 
            flameDimension: analysisData.flameDimension,
            sentimentScore: analysisData.sentimentScore,
            summary: analysisData.summary?.substring(0, 50),
            relatedContracts: analysisData.relatedContracts
          });
          
          const summary = analysisData.summary || input.title || "文章摘要";
          
          console.log("[submitText] Saving to database", { title: input.title, summary: summary?.substring(0, 50) });
          
          const result = await createExternalView({
            sourceType: "user_submission",
            sourceName: input.author || "用户提交",
            author: input.author,
            title: input.title,
            summary: summary,
            fullContent: input.content,
            sentiment: analysisData.sentimentScore > 0 ? "bullish" : analysisData.sentimentScore < 0 ? "bearish" : "neutral",
            flameDimension: analysisData.flameDimension,
            sentimentScore: analysisData.sentimentScore,
            expectationGap: analysisData.expectationGap,
            relatedContracts: analysisData.relatedContracts,
          });
          
          console.log("[submitText] Success", { id: result?.id });
          return { data: result };
        } catch (error) {
          console.error("[submitText] Error", error);
          throw error;
        }
      }),

    create: protectedProcedure
      .input(
        z.object({
          sourceType: z.string(),
          sourceName: z.string(),
          author: z.string().optional(),
          title: z.string(),
          summary: z.string(),
          fullContent: z.string().optional(),
          sentiment: z.enum(["bullish", "bearish", "neutral"]).optional(),
          url: z.string().optional(),
          relatedContracts: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await createExternalView({
          sourceType: input.sourceType,
          sourceName: input.sourceName,
          author: input.author,
          title: input.title,
          summary: input.summary,
          fullContent: input.fullContent,
          sentiment: (input.sentiment || "neutral") as "bullish" | "bearish" | "neutral",
          url: input.url,
          relatedContracts: input.relatedContracts,
        });
      }),
  }),

  // ============ View Conclusions ============
  viewConclusions: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(10), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        return await getViewConclusions(ctx.user.id, input.limit, input.offset);
      }),

    weeklyReports: protectedProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input, ctx }) => {
        return await getWeeklyFlameReports(ctx.user.id, input.limit);
      }),

    autoAnalyze: protectedProcedure
      .mutation(async ({ ctx }) => {
        try {
          const recentViews = await getExternalViews(30, 0);
          
          if (!recentViews || recentViews.length === 0) {
            return {
              success: false,
              message: 'no views available'
            };
          }

          const viewsContext = recentViews
            .map((v) => `Source: ${v.sourceName}\nTitle: ${v.title}\nSummary: ${v.summary}`)
            .join('\n---\n');

          const response = await invokeLLM({
            messages: [
              {
                role: 'system',
                content: 'You are a professional treasury futures analyst. Synthesize multiple research reports and views into a coherent conclusion. Focus on market consensus, main risks, and trading recommendations.'
              },
              {
                role: 'user',
                content: `Generate a comprehensive conclusion based on these research reports and views:\n\n${viewsContext}`
              }
            ]
          });

          const conclusion = typeof response.choices[0]?.message.content === 'string' 
            ? response.choices[0].message.content 
            : 'Unable to generate conclusion';

          const bullishCount = recentViews.filter(v => v.sentiment === 'bullish').length;
          const bearishCount = recentViews.filter(v => v.sentiment === 'bearish').length;
          const overallSentiment = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral';
          const consensusScore = Math.round((Math.max(bullishCount, bearishCount) / recentViews.length) * 100);

          const viewIds = recentViews.map(v => v.id);
          await createViewConclusion({
            userId: ctx.user.id,
            title: `Auto Analysis - ${new Date().toLocaleDateString('zh-CN')}`,
            conclusion,
            overallSentiment,
            consensusScore,
            viewIds: viewIds as any
          });

          return {
            success: true,
            message: `Successfully generated conclusion based on ${recentViews.length} views with ${consensusScore}% consensus`,
            conclusion,
            overallSentiment,
            consensusScore
          };
        } catch (error) {
          console.error('[ViewConclusions] Error in autoAnalyze:', error);
          return {
            success: false,
            message: 'Analysis failed, please try again later'
          };
        }
      }),

    generate: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          viewIds: z.array(z.number()),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const views = await getExternalViews(100);
        const selectedViews = views.filter((v) => input.viewIds.includes(v.id));

        const viewsContext = selectedViews
          .map((v) => `${v.sourceName} (${v.author}): ${v.summary}`)
          .join("\n\n");

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a professional analyst. Synthesize multiple market views into a coherent conclusion.",
            },
            {
              role: "user",
              content: `Analyze these market views and provide a synthesized conclusion:\n\n${viewsContext}`,
            },
          ],
        });

        const rawConclusion = response.choices[0]?.message.content;
        const conclusion =
          typeof rawConclusion === "string" ? rawConclusion : "Unable to generate conclusion";

        let overallSentiment: "bullish" | "bearish" | "neutral" = "neutral";
        const bullishCount = selectedViews.filter((v) => v.sentiment === "bullish").length;
        const bearishCount = selectedViews.filter((v) => v.sentiment === "bearish").length;

        if (bullishCount > bearishCount) overallSentiment = "bullish";
        else if (bearishCount > bullishCount) overallSentiment = "bearish";

        const consensusScore = Math.round(
          (Math.max(bullishCount, bearishCount) / selectedViews.length) * 100
        );

        return await createViewConclusion({
          userId: ctx.user.id,
          title: input.title,
          conclusion,
          viewIds: input.viewIds as any,
          overallSentiment,
          consensusScore,
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }),
  }),

  // ============ Trade Records ============
  tradeRecords: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        return await getTradeRecords(ctx.user.id, input.limit, input.offset);
      }),

    openTrades: protectedProcedure.query(async ({ ctx }) => {
      return await getOpenTrades(ctx.user.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          contract: z.string(),
          direction: z.enum(["long", "short"]),
          entryPrice: z.number(),
          entryTime: z.date(),
          quantity: z.number(),
          notes: z.string().optional(),
          relatedSignalId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await createTradeRecord({
          userId: ctx.user.id,
          contract: input.contract,
          direction: input.direction,
          entryPrice: String(input.entryPrice),
          entryTime: input.entryTime,
          quantity: input.quantity,
          notes: input.notes,
          relatedSignalId: input.relatedSignalId,
          status: "open",
        });
      }),

    close: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          exitPrice: z.number(),
          exitTime: z.date(),
        })
      )
      .mutation(async ({ input }) => {
        return await updateTradeRecord(input.id, {
          exitPrice: String(input.exitPrice),
          exitTime: input.exitTime,
          status: "closed",
        });
      }),
  }),

  // ============ Trade Reviews ============
  tradeReviews: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        return await getTradeReviews(ctx.user.id, input.limit, input.offset);
      }),

    getByTradeId: protectedProcedure
      .input(z.object({ tradeId: z.number() }))
      .query(async ({ input }) => {
        return await getTradeReviewByTradeId(input.tradeId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          tradeId: z.number(),
          title: z.string(),
          strengths: z.string().optional(),
          weaknesses: z.string().optional(),
          improvements: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await createTradeReview({
          userId: ctx.user.id,
          ...input,
          status: "draft",
        });
      }),

    generateAnalysis: protectedProcedure
      .input(
        z.object({
          tradeId: z.number(),
          entryReason: z.string(),
          exitReason: z.string(),
          profitLoss: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a professional trading coach. Analyze a trade and provide constructive feedback on strengths, weaknesses, and improvements.",
            },
            {
              role: "user",
              content: `Analyze this trade:\nEntry Reason: ${input.entryReason}\nExit Reason: ${input.exitReason}\nProfit/Loss: ${input.profitLoss} points\n\nProvide detailed analysis of strengths, weaknesses, and areas for improvement.`,
            },
          ],
        });

        const content = response.choices[0]?.message.content;
        const analysis = typeof content === "string" ? content : "";

        const strengthsMatch = analysis.match(/strengths?:\s*([\s\S]*?)(?=weaknesses?:|$)/i);
        const weaknessesMatch = analysis.match(/weaknesses?:\s*([\s\S]*?)(?=improvements?:|$)/i);
        const improvementsMatch = analysis.match(/improvements?:\s*([\s\S]*?)$/i);

        const strengths = strengthsMatch ? strengthsMatch[1].trim() : "";
        const weaknesses = weaknessesMatch ? weaknessesMatch[1].trim() : "";
        const improvements = improvementsMatch ? improvementsMatch[1].trim() : "";

        let score = 50;
        if (input.profitLoss > 0) score = Math.min(100, 50 + (input.profitLoss / 10) * 10);
        else if (input.profitLoss < 0) score = Math.max(0, 50 + (input.profitLoss / 10) * 10);

        const review = await createTradeReview({
          userId: ctx.user.id,
          tradeId: input.tradeId,
          title: `Trade Review - ${new Date().toLocaleDateString()}`,
          strengths,
          weaknesses,
          improvements,
          overallScore: Math.round(score),
          keyLearnings: analysis,
          status: "completed",
        });

        return review;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          strengths: z.string().optional(),
          weaknesses: z.string().optional(),
          improvements: z.string().optional(),
          overallScore: z.number().optional(),
          status: z.enum(["draft", "completed"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return await updateTradeReview(id, updates as any);
      }),
  }),

  // ============ Email Automation ============
  emailAutomation: router({
    fetchNow: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        await fetchEmailSignals();
        return {
          success: true,
          message: "邮件抓取成功",
        };
      } catch (error) {
        console.error("[Email Automation] Fetch failed:", error);
        return {
          success: false,
          message: "邮件抓取失败",
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    }),

    startPolling: protectedProcedure
      .input(
        z.object({
          intervalMinutes: z.number().min(1).max(60).default(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          startEmailPolling(input.intervalMinutes);
          return {
            success: true,
            message: `已启动每 ${input.intervalMinutes} 分钟检查一次邮件`,
          };
        } catch (error) {
          console.error("[Email Automation] Start polling failed:", error);
          return {
            success: false,
            message: "启动自动抓取失败",
            error: error instanceof Error ? error.message : "未知错误",
          };
        }
      }),
  }),

  // ============ Dashboard ============
  dashboard: router({
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      return await getDashboardConfig(ctx.user.id);
    }),

    updateConfig: protectedProcedure
      .input(
        z.object({
          layout: z.any().optional(),
          widgets: z.array(z.string()).optional(),
          defaultTimeRange: z.string().optional(),
          showRiskWarning: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await createOrUpdateDashboardConfig({
          userId: ctx.user.id,
          layout: input.layout,
          widgets: input.widgets,
          defaultTimeRange: input.defaultTimeRange,
          showRiskWarning: input.showRiskWarning,
        });
      }),

    getStatistics: protectedProcedure.query(async ({ ctx }) => {
      return await getTradeStatistics(ctx.user.id);
    }),

    getSummary: protectedProcedure.query(async ({ ctx }) => {
      const stats = await getTradeStatistics(ctx.user.id);
      const recentSignals = await getEmailSignals(ctx.user.id, 5);
      const recentAnalysis = await getFundamentalAnalysis(ctx.user.id, 3);
      const recentViews = await getExternalViews(5);
      const recentTrades = await getTradeRecords(ctx.user.id, 5);

      return {
        statistics: stats,
        recentSignals,
        recentAnalysis,
        recentViews,
        recentTrades,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
