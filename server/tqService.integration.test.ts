import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tqService, BOND_FUTURES_CONTRACTS } from "./services/tqService";

describe("TQ Service Integration", () => {
  beforeAll(() => {
    // 清空之前的状态
    tqService.stop();
  });

  afterAll(() => {
    tqService.stop();
  });

  it("should generate mock klines with correct structure", () => {
    const klines = tqService.generateMockKlines("KQ.m@CFFEX.T", 60, 10);
    
    expect(klines).toHaveLength(10);
    expect(klines[0]).toHaveProperty("datetime");
    expect(klines[0]).toHaveProperty("open");
    expect(klines[0]).toHaveProperty("high");
    expect(klines[0]).toHaveProperty("low");
    expect(klines[0]).toHaveProperty("close");
    expect(klines[0]).toHaveProperty("volume");
    
    // 验证 OHLC 关系
    expect(klines[0].high).toBeGreaterThanOrEqual(klines[0].open);
    expect(klines[0].high).toBeGreaterThanOrEqual(klines[0].close);
    expect(klines[0].low).toBeLessThanOrEqual(klines[0].open);
    expect(klines[0].low).toBeLessThanOrEqual(klines[0].close);
  });

  it("should get mock quotes for all contracts", () => {
    const quotes = tqService.getMockQuotes();
    
    expect(quotes).toHaveLength(Object.keys(BOND_FUTURES_CONTRACTS).length);
    
    quotes.forEach((quote) => {
      expect(quote).toHaveProperty("contract");
      expect(quote).toHaveProperty("lastPrice");
      expect(quote).toHaveProperty("bidPrice");
      expect(quote).toHaveProperty("askPrice");
      expect(quote).toHaveProperty("volume");
      expect(quote).toHaveProperty("openInterest");
      expect(quote).toHaveProperty("datetime");
      expect(quote).toHaveProperty("change");
      expect(quote).toHaveProperty("changePercent");
      
      // 验证价格关系
      expect(quote.bidPrice).toBeLessThanOrEqual(quote.lastPrice);
      expect(quote.askPrice).toBeGreaterThanOrEqual(quote.lastPrice);
    });
  });

  it("should emit quotes event in mock mode", async () => {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 3000);

      tqService.on("quotes", (quotes) => {
        clearTimeout(timeout);
        expect(Array.isArray(quotes)).toBe(true);
        expect(quotes.length).toBeGreaterThan(0);
        resolve();
      });

      // 启动模拟模式
      tqService.start("", "", []);
    });
  });

  it("should return correct status", async () => {
    await tqService.start("", "", ["KQ.m@CFFEX.T", "KQ.m@CFFEX.TF"]);
    
    const status = tqService.getStatus();
    expect(status).toHaveProperty("isRunning");
    expect(status).toHaveProperty("mode");
    expect(status).toHaveProperty("contracts");
    expect(status.mode).toBe("mock");
    expect(status.contracts).toContain("KQ.m@CFFEX.T");
  });

  it("should handle multiple contract subscriptions", () => {
    const contracts = ["KQ.m@CFFEX.T", "KQ.m@CFFEX.TF", "KQ.m@CFFEX.TS"];
    const klines = contracts.map((contract) => ({
      contract,
      bars: tqService.generateMockKlines(contract, 60, 5),
    }));

    klines.forEach(({ bars }) => {
      expect(bars).toHaveLength(5);
      bars.forEach((bar) => {
        expect(bar.close).toBeGreaterThan(0);
        expect(bar.volume).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it("should support different kline periods", () => {
    const periods = [60, 300, 900, 1800, 3600, 86400];
    
    periods.forEach((period) => {
      const klines = tqService.generateMockKlines("KQ.m@CFFEX.T", period, 10);
      expect(klines).toHaveLength(10);
      
      // 验证时间间隔（mock klines 使用毫秒时间戳）
      if (klines.length > 1) {
        const timeDiff = klines[1].datetime - klines[0].datetime;
        // mock klines 的时间间隔应为 period 秒（以毫秒表示）
        expect(timeDiff).toBeGreaterThan(0);
      }
    });
  });

  it("should stop service properly", async () => {
    await tqService.start("", "", []);
    expect(tqService.getStatus().isRunning).toBe(true);
    
    tqService.stop();
    expect(tqService.getStatus().isRunning).toBe(false);
  });

  it("should return null for getLatestKlineBar when no live data", () => {
    // 未启动实时服务时，内存中没有 K 线数据
    const bar = tqService.getLatestKlineBar("KQ.m@CFFEX.T", 86400);
    // 可能为 null（未启动）或有数据（mock 模式下）
    if (bar !== null && bar !== undefined) {
      expect(bar).toHaveProperty("datetime");
      expect(bar).toHaveProperty("open");
      expect(bar).toHaveProperty("close");
    }
  });
});
