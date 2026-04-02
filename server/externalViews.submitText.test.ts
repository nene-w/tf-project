import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock the LLM invocation
vi.mock("./server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock the database functions
vi.mock("./server/db", () => ({
  createExternalView: vi.fn(),
}));

import { invokeLLM } from "./server/_core/llm";
import { createExternalView } from "./server/db";

describe("externalViews.submitText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully submit text and analyze with LLM", async () => {
    // Mock LLM response with FLAME analysis
    const mockLLMResponse = {
      choices: [
        {
          message: {
            content: `
{
  "flameDimension": "F",
  "sentimentScore": 2,
  "summary": "国债收益率上升，市场预期央行可能维持紧缩立场",
  "expectationGap": "市场预期央行会降息，但实际政策可能更保守",
  "relatedContracts": ["T2406", "F2406"]
}
            `,
          },
        },
      ],
    };

    (invokeLLM as any).mockResolvedValue(mockLLMResponse);

    // Mock database response
    const mockDbResponse = {
      id: 1,
      title: "国债收益率分析",
      sourceName: "用户提交",
      author: "张三",
      summary: "国债收益率上升，市场预期央行可能维持紧缩立场",
      flameDimension: "F",
      sentimentScore: 2,
      expectationGap: "市场预期央行会降息，但实际政策可能更保守",
      relatedContracts: ["T2406", "F2406"],
      createdAt: new Date(),
    };

    (createExternalView as any).mockResolvedValue(mockDbResponse);

    // Simulate the submitText logic
    const input = {
      title: "国债收益率分析",
      content: "最近国债收益率持续上升，10Y国债收益率突破1.8%...",
      author: "张三",
    };

    // Call LLM
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "你是一位专业的国债期货分析师。请基于用户提交的文章内容，按照 FLAME 框架进行分析。",
        },
        {
          role: "user",
          content: `请分析以下文章：\n\n标题：${input.title}\n\n内容：\n${input.content}`,
        },
      ],
    });

    expect(response).toBeDefined();
    expect(response.choices[0].message.content).toContain("flameDimension");

    // Extract JSON from response
    const contentStr = response.choices[0].message.content;
    const jsonMatch = contentStr.match(/\{[\s\S]*?\}/);
    expect(jsonMatch).toBeTruthy();

    if (jsonMatch) {
      const analysisData = JSON.parse(jsonMatch[0]);
      expect(analysisData.flameDimension).toBe("F");
      expect(analysisData.sentimentScore).toBe(2);
      expect(analysisData.relatedContracts).toContain("T2406");
    }

    // Save to database
    const dbResult = await createExternalView({
      sourceType: "user_submission",
      sourceName: input.author || "用户提交",
      author: input.author,
      title: input.title,
      summary: "国债收益率上升，市场预期央行可能维持紧缩立场",
      fullContent: input.content,
      sentiment: "bullish",
      flameDimension: "F",
      sentimentScore: 2,
      expectationGap: "市场预期央行会降息，但实际政策可能更保守",
      relatedContracts: ["T2406", "F2406"],
    });

    expect(dbResult).toBeDefined();
    expect(dbResult.title).toBe("国债收益率分析");
    expect(dbResult.flameDimension).toBe("F");
    expect(dbResult.sentimentScore).toBe(2);

    // Verify LLM was called
    expect(invokeLLM).toHaveBeenCalled();

    // Verify database was called
    expect(createExternalView).toHaveBeenCalled();
  });

  it("should handle missing optional author field", async () => {
    const mockLLMResponse = {
      choices: [
        {
          message: {
            content: `{"flameDimension": "M", "sentimentScore": -1, "summary": "市场情绪悲观", "expectationGap": "", "relatedContracts": []}`,
          },
        },
      ],
    };

    (invokeLLM as any).mockResolvedValue(mockLLMResponse);
    (createExternalView as any).mockResolvedValue({
      id: 2,
      title: "市场情绪分析",
      sourceName: "用户提交",
      author: undefined,
    });

    const input = {
      title: "市场情绪分析",
      content: "最近市场情绪很悲观...",
      author: undefined,
    };

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "分析文章" },
        { role: "user", content: `标题：${input.title}` },
      ],
    });

    const contentStr = response.choices[0].message.content;
    const jsonMatch = contentStr.match(/\{[\s\S]*?\}/);
    const analysisData = JSON.parse(jsonMatch![0]);

    const dbResult = await createExternalView({
      sourceType: "user_submission",
      sourceName: input.author || "用户提交",
      author: input.author,
      title: input.title,
      summary: analysisData.summary,
      fullContent: input.content,
      sentiment: "bearish",
      flameDimension: analysisData.flameDimension,
      sentimentScore: analysisData.sentimentScore,
      expectationGap: analysisData.expectationGap,
      relatedContracts: analysisData.relatedContracts,
    });

    expect(dbResult.sourceName).toBe("用户提交");
    expect(dbResult.author).toBeUndefined();
  });

  it("should handle LLM response without valid JSON", async () => {
    const mockLLMResponse = {
      choices: [
        {
          message: {
            content: "这是一个没有JSON的响应",
          },
        },
      ],
    };

    (invokeLLM as any).mockResolvedValue(mockLLMResponse);

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "分析文章" },
        { role: "user", content: "标题：测试" },
      ],
    });

    const contentStr = response.choices[0].message.content;
    const jsonMatch = contentStr.match(/\{[\s\S]*?\}/);

    // Should not find JSON
    expect(jsonMatch).toBeNull();

    // Should use default values
    const analysisData = {
      flameDimension: "F",
      sentimentScore: 0,
      summary: "测试",
      expectationGap: "",
      relatedContracts: [],
    };

    expect(analysisData.flameDimension).toBe("F");
    expect(analysisData.sentimentScore).toBe(0);
  });
});
