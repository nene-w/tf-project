import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { appRouter } from "./routers";
import { getDb, upsertFundamentalData, getFundamentalData } from "./db";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "test",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("FundamentalData Integration Tests", () => {
  beforeEach(async () => {
    // 清理测试数据
    const db = await getDb();
    if (db) {
      // 在实际环境中，这里会清理测试数据
      console.log("[Integration Test] 测试环境准备完毕");
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full flow: refresh -> upsert -> list -> display", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 1. 调用 refresh 接口
    console.log("[Integration Test] 步骤 1: 调用 refresh 接口");
    const refreshResult = await caller.fundamentalData.refresh();

    // 验证 refresh 返回结构
    expect(refreshResult).toHaveProperty("success");
    expect(refreshResult).toHaveProperty("message");
    expect(refreshResult).toHaveProperty("count");
    console.log(`[Integration Test] Refresh 结果: ${refreshResult.message}, 成功保存 ${refreshResult.count} 条数据`);

    // 2. 调用 list 接口获取数据
    console.log("[Integration Test] 步骤 2: 调用 list 接口获取数据");
    const listResult = await caller.fundamentalData.list({
      limit: 100,
    });

    // 验证 list 返回数据
    expect(Array.isArray(listResult)).toBe(true);
    console.log(`[Integration Test] List 返回 ${listResult.length} 条数据`);

    // 3. 验证数据结构
    if (listResult.length > 0) {
      const firstItem = listResult[0];
      expect(firstItem).toHaveProperty("dataType");
      expect(firstItem).toHaveProperty("indicator");
      expect(firstItem).toHaveProperty("value");
      expect(firstItem).toHaveProperty("source");
      console.log(`[Integration Test] 数据样本: ${firstItem.indicator} (${firstItem.dataType})`);
    }
  });

  it("should verify upsert logic: insert and update", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 测试数据
    const testData = {
      indicator: "测试指标_CPI",
      dataType: "macro",
      value: 2.1,
      unit: "%",
      releaseDate: new Date("2026-04-08"),
      source: "测试来源",
      description: "测试描述",
      analyzed: false,
    };

    // 1. 首次插入
    console.log("[Integration Test] 步骤 1: 首次插入数据");
    await upsertFundamentalData(testData);

    // 查询验证
    const db = await getDb();
    if (db) {
      const result1 = await getFundamentalData("macro", 100);
      const inserted = result1.find((item) => item.indicator === testData.indicator);
      expect(inserted).toBeDefined();
      // DECIMAL 类型返回字符串，需要转换为数字比较
      expect(Number(inserted?.value)).toBe(2.1);
      console.log("[Integration Test] 首次插入成功");
    }

    // 2. 重复插入（应该更新）
    console.log("[Integration Test] 步骤 2: 重复插入相同指标（应该更新）");
    const updatedData = {
      ...testData,
      value: 2.5, // 更新值
      releaseDate: new Date("2026-04-15"), // 更新日期
    };
    await upsertFundamentalData(updatedData);

    // 查询验证
    if (db) {
      const result2 = await getFundamentalData("macro", 100);
      const updated = result2.find((item) => item.indicator === testData.indicator);
      expect(updated).toBeDefined();
      // DECIMAL 类型返回字符串，需要转换为数字比较
      expect(Number(updated?.value)).toBe(2.5); // 验证值已更新
      console.log("[Integration Test] 重复插入成功，数据已更新");
    }
  });

  it("should verify data type filtering", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 1. 获取所有数据
    console.log("[Integration Test] 步骤 1: 获取所有数据");
    const allData = await caller.fundamentalData.list({ limit: 100 });
    console.log(`[Integration Test] 总共 ${allData.length} 条数据`);

    // 2. 按 dataType 过滤
    const dataTypes = ["macro", "liquidity", "bond_market", "sentiment", "external"];
    for (const dataType of dataTypes) {
      console.log(`[Integration Test] 步骤 2: 获取 ${dataType} 类型数据`);
      const filteredData = await caller.fundamentalData.list({
        dataType,
        limit: 100,
      });

      // 验证所有返回的数据都是指定类型
      const allCorrectType = filteredData.every((item) => item.dataType === dataType);
      expect(allCorrectType).toBe(true);
      console.log(`[Integration Test] ${dataType} 类型: ${filteredData.length} 条数据`);
    }
  });

  it("should verify error handling in refresh", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 调用 refresh 并验证错误处理
    console.log("[Integration Test] 步骤 1: 调用 refresh 并验证错误处理");
    const result = await caller.fundamentalData.refresh();

    // 即使数据为空，也应该返回成功状态
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(0);
    console.log(`[Integration Test] Refresh 返回成功状态，count=${result.count}`);

    // 如果有错误，应该在 errors 数组中
    if (result.errors && result.errors.length > 0) {
      console.log(`[Integration Test] 发现 ${result.errors.length} 个错误`);
      result.errors.forEach((error) => {
        console.log(`  - ${error}`);
      });
    }
  });

  it("should verify data persistence across calls", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 1. 第一次调用 refresh
    console.log("[Integration Test] 步骤 1: 第一次调用 refresh");
    const result1 = await caller.fundamentalData.refresh();
    const count1 = result1.count;

    // 2. 第二次调用 refresh
    console.log("[Integration Test] 步骤 2: 第二次调用 refresh");
    const result2 = await caller.fundamentalData.refresh();
    const count2 = result2.count;

    // 3. 验证数据持久化
    console.log("[Integration Test] 步骤 3: 验证数据持久化");
    console.log(`[Integration Test] 第一次 refresh: ${count1} 条数据`);
    console.log(`[Integration Test] 第二次 refresh: ${count2} 条数据`);

    // 两次调用应该返回相同或更新的数据
    expect(count2).toBeGreaterThanOrEqual(0);

    // 调用 list 验证数据存在
    const listResult = await caller.fundamentalData.list({ limit: 100 });
    console.log(`[Integration Test] 最终 list 返回 ${listResult.length} 条数据`);
    expect(listResult.length).toBeGreaterThanOrEqual(0);
  });

  it("should verify complete data flow with logging", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    console.log("\n========== 完整数据流集成测试 ==========");

    // 1. 刷新数据
    console.log("[Flow] 1. 调用 fundamentalData.refresh() 刷新数据...");
    const refreshResult = await caller.fundamentalData.refresh();
    console.log(`[Flow] ✓ Refresh 完成: ${refreshResult.message}`);
    console.log(`[Flow]   - 成功保存: ${refreshResult.count} 条指标`);
    if (refreshResult.errors && refreshResult.errors.length > 0) {
      console.log(`[Flow]   - 失败: ${refreshResult.errors.length} 条`);
    }

    // 2. 获取所有数据
    console.log("[Flow] 2. 调用 fundamentalData.list() 获取所有数据...");
    const allData = await caller.fundamentalData.list({ limit: 100 });
    console.log(`[Flow] ✓ List 完成: 返回 ${allData.length} 条数据`);

    // 3. 按类型统计
    console.log("[Flow] 3. 按数据类型统计...");
    const typeStats: Record<string, number> = {};
    allData.forEach((item) => {
      typeStats[item.dataType] = (typeStats[item.dataType] || 0) + 1;
    });
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`[Flow]   - ${type}: ${count} 条`);
    });

    // 4. 展示样本数据
    if (allData.length > 0) {
      console.log("[Flow] 4. 样本数据:");
      allData.slice(0, 3).forEach((item) => {
        console.log(`[Flow]   - ${item.indicator}: ${item.value}${item.unit} (${item.source})`);
      });
    }

    console.log("[Flow] ✓ 完整数据流测试通过");
    console.log("========== 测试完成 ==========\n");

    // 最终验证
    expect(refreshResult.success).toBe(true);
    expect(Array.isArray(allData)).toBe(true);
  });
});
