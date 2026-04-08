import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFLAMEData } from "./fetch_flame_data_wrapper";

describe("FLAME Data Refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch FLAME data successfully", async () => {
    const data = await fetchFLAMEData();
    
    // 验证返回的是数组
    expect(Array.isArray(data)).toBe(true);
    
    // 验证数据不为空
    expect(data.length).toBeGreaterThan(0);
  }, 30000);

  it("should have correct data structure", async () => {
    const data = await fetchFLAMEData();
    
    if (data.length > 0) {
      const item = data[0];
      
      // 验证必需字段
      expect(item).toHaveProperty("dataType");
      expect(item).toHaveProperty("indicator");
      expect(item).toHaveProperty("value");
      expect(item).toHaveProperty("source");
      
      // 验证数据类型
      expect(typeof item.dataType).toBe("string");
      expect(typeof item.indicator).toBe("string");
      // value 可以是 number 或 null（AKShare 无法获取时返回 null）
      expect(item.value === null || typeof item.value === "number").toBe(true);
      expect(typeof item.source).toBe("string");
    }
  }, 30000);

  it("should contain all FLAME dimensions", async () => {
    const data = await fetchFLAMEData();
    
    const dataTypes = new Set(data.map((item) => item.dataType));
    
    // 验证包含所有 FLAME 维度
    expect(dataTypes.has("macro")).toBe(true); // F: 基本面
    expect(dataTypes.has("liquidity")).toBe(true); // L: 流动性
    expect(dataTypes.has("bond_market")).toBe(true); // A: 债券供需
    expect(dataTypes.has("sentiment")).toBe(true); // M: 市场情绪
    expect(dataTypes.has("external")).toBe(true); // E: 外部环境
  }, 30000);

  it("should have valid numeric values or null", async () => {
    const data = await fetchFLAMEData();
    
    data.forEach((item) => {
      // value 允许为 null（AKShare 无法获取时）或有效数字
      if (item.value !== null) {
        expect(typeof item.value).toBe("number");
        expect(isNaN(item.value as number)).toBe(false);
        expect(isFinite(item.value as number)).toBe(true);
      }
    });
  }, 30000);

  it("should have proper date format for releaseDate", async () => {
    const data = await fetchFLAMEData();
    
    data.forEach((item) => {
      if (item.releaseDate) {
        // 验证日期格式（YYYY-MM-DD）
        expect(/^\d{4}-\d{2}-\d{2}$/.test(item.releaseDate)).toBe(true);
      }
    });
  }, 30000);
});
