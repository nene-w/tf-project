import { describe, it, expect } from "vitest";
import { parseEmailSubject } from "./emailService";

describe("Email Service - parseEmailSubject", () => {
  it("应该解析二债买入信号", () => {
    const subject = "二债 2026-03-27 买入_15";
    const result = parseEmailSubject(subject);

    expect(result).not.toBeNull();
    expect(result?.variety).toBe("二债");
    expect(result?.signalType).toBe("buy");
    expect(result?.period).toBe("15");
    expect(result?.contract).toMatch(/^T2/);
  });

  it("应该解析五债卖出信号", () => {
    const subject = "五债 2026-03-27 卖出_30";
    const result = parseEmailSubject(subject);

    expect(result).not.toBeNull();
    expect(result?.variety).toBe("五债");
    expect(result?.signalType).toBe("sell");
    expect(result?.period).toBe("30");
    expect(result?.contract).toMatch(/^T5/);
  });

  it("应该解析十债日线信号", () => {
    const subject = "十债 2026-03-27 买入_日";
    const result = parseEmailSubject(subject);

    expect(result).not.toBeNull();
    expect(result?.variety).toBe("十债");
    expect(result?.signalType).toBe("buy");
    expect(result?.period).toBe("day");
    expect(result?.contract).toMatch(/^T10/);
  });

  it("应该解析30债60分钟信号", () => {
    const subject = "30债 2026-03-27 卖出_60";
    const result = parseEmailSubject(subject);

    expect(result).not.toBeNull();
    expect(result?.variety).toBe("30债");
    expect(result?.signalType).toBe("sell");
    expect(result?.period).toBe("60");
    expect(result?.contract).toMatch(/^T30/);
  });

  it("应该返回 null 当主题不包含有效的品种", () => {
    const subject = "其他内容 2026-03-27 买入_15";
    const result = parseEmailSubject(subject);

    expect(result).toBeNull();
  });

  it("应该返回 null 当主题不包含日期", () => {
    const subject = "二债 买入_15";
    const result = parseEmailSubject(subject);

    expect(result).toBeNull();
  });

  it("应该返回 null 当主题不包含交易类型", () => {
    const subject = "二债 2026-03-27";
    const result = parseEmailSubject(subject);

    expect(result).toBeNull();
  });

  it("应该正确解析多个信号（返回第一个匹配的）", () => {
    const subject = "二债 2026-03-27 买入_15 卖出_30";
    const result = parseEmailSubject(subject);

    expect(result).not.toBeNull();
    expect(result?.signalType).toBe("buy");
    expect(result?.period).toBe("15");
  });

  it("应该正确生成合约代码", () => {
    const subject = "二债 2026-06-15 买入_15";
    const result = parseEmailSubject(subject);

    expect(result?.contract).toBe("T20626"); // T2 + 06 + 26
  });

  it("应该处理不同的日期格式", () => {
    const subject = "十债 2026-12-31 买入_30";
    const result = parseEmailSubject(subject);

    expect(result).not.toBeNull();
    expect(result?.date).toEqual(new Date("2026-12-31"));
  });
});
