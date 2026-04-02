import { invokeLLM } from "./_core/llm";
import { createExternalView } from "./db";
import * as cheerio from "cheerio";
import axios from "axios";

export async function fetchAndAnalyzeUrl(userId: number, url: string) {
  try {
    // 1. 抓取网页内容
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    // 针对微信公众号的特殊处理
    let title = $("meta[property='og:title']").attr("content") || $("title").text() || "未命名文章";
    let author = $("meta[property='og:article:author']").attr("content") || $(".rich_media_meta_text").first().text().trim() || "未知作者";
    let sourceName = "微信公众号";
    
    // 提取正文（针对微信公众号优化）
    let content = $("#js_content").text().trim() || $("body").text().trim();
    // 限制长度以防 token 溢出，取前 5000 字
    const truncatedContent = content.substring(0, 5000);

    // 2. 调用 AI 进行分析
    const aiResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一位专业的国债期货分析师。请阅读以下文章内容，并提取核心观点。
          
输出格式要求（严格按照以下 JSON 格式，不要包含 Markdown 代码块标记）：
{
  "summary": "简明扼要的摘要（100-200字）",
  "sentiment": "bullish" | "bearish" | "neutral",
  "keyPoints": ["核心观点1", "核心观点2", ...],
  "relatedContracts": ["T2406", "TF2409", ...]
}`,
        },
        {
          role: "user",
          content: `文章标题：${title}\n文章作者：${author}\n文章正文：\n${truncatedContent}`,
        },
      ],
    });

    const aiResultRaw = aiResponse.choices[0]?.message.content || "{}";
    let aiResult;
    try {
      // 尝试解析 JSON，如果 AI 返回了带 Markdown 的字符串，先清理
      const cleanJson = aiResultRaw.replace(/```json|```/g, "").trim();
      aiResult = JSON.parse(cleanJson);
    } catch (e) {
      console.error("[URL Scraper] AI JSON parse error:", e, aiResultRaw);
      aiResult = {
        summary: title,
        sentiment: "neutral",
        keyPoints: [],
        relatedContracts: [],
      };
    }

    // 3. 存储到数据库（如果数据库可用）
    let externalView;
    try {
      externalView = await createExternalView({
        sourceType: "wechat_article",
        sourceName: sourceName,
        author: author,
        title: title,
        summary: aiResult.summary || title,
        fullContent: truncatedContent,
        sentiment: aiResult.sentiment || "neutral",
        url: url,
        relatedContracts: aiResult.relatedContracts || [],
      });
    } catch (dbError) {
      console.warn("[URL Scraper] Database save failed, returning AI result only:", dbError);
      // 无数据库模式下构造一个模拟对象返回
      externalView = {
        id: Date.now(),
        sourceType: "wechat_article",
        sourceName: sourceName,
        author: author,
        title: title,
        summary: aiResult.summary || title,
        sentiment: aiResult.sentiment || "neutral",
        url: url,
        relatedContracts: aiResult.relatedContracts || [],
        createdAt: new Date(),
      };
    }

    return {
      success: true,
      data: externalView,
      aiAnalysis: aiResult,
    };
  } catch (error: any) {
    console.error("[URL Scraper] Error:", error.message);
    // 打印详细错误堆栈以便调试
    if (error.stack) console.error(error.stack);
    throw new Error(`抓取失败: ${error.message}`);
  }
}
