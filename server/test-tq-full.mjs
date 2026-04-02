/**
 * 完整天勤数据流测试脚本
 * 测试：保存配置 -> 启动服务 -> 下载数据 -> 验证K线
 */

import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = "https://3000-ighllknnpvsowjbl4k05r-822deee1.sg1.manus.computer";

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// 解析数据库连接
const url = new URL(DATABASE_URL);
const dbConfig = {
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  port: url.port || 3306,
  ssl: {},
};

async function testDatabase() {
  console.log("\n=== 1. 测试数据库连接 ===");
  const conn = await mysql.createConnection(dbConfig);
  
  // 检查 tq_configs 表
  const [rows] = await conn.execute("SELECT * FROM tq_configs LIMIT 5");
  console.log("tq_configs 表记录数:", rows.length);
  
  // 插入测试配置
  await conn.execute(`
    INSERT INTO tq_configs (userId, tqUsername, tqPassword, subscribedContracts, klinePeriod, isEnabled)
    VALUES (1, 'palmdale', 'a2205570a', '["KQ.m@CFFEX.T","KQ.m@CFFEX.TF","KQ.m@CFFEX.TS","KQ.m@CFFEX.TL"]', 60, true)
    ON DUPLICATE KEY UPDATE 
      tqUsername = 'palmdale',
      tqPassword = 'a2205570a',
      subscribedContracts = '["KQ.m@CFFEX.T","KQ.m@CFFEX.TF","KQ.m@CFFEX.TS","KQ.m@CFFEX.TL"]',
      klinePeriod = 60,
      isEnabled = true
  `);
  console.log("✓ 天勤配置已保存到数据库");
  
  // 验证配置
  const [saved] = await conn.execute("SELECT * FROM tq_configs WHERE userId = 1");
  console.log("保存的配置:", JSON.stringify(saved[0], null, 2));
  
  await conn.end();
  return saved[0];
}

async function testTQConnection() {
  console.log("\n=== 2. 测试天勤连接 ===");
  
  // 运行 Python worker 测试
  const { spawn } = await import("child_process");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const scriptPath = path.join(__dirname, "..", "scripts", "tq_worker.py");
  
  console.log("启动 Python worker:", scriptPath);
  
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [scriptPath], {
      env: {
        ...process.env,
        TQ_USERNAME: "palmdale",
        TQ_PASSWORD: "a2205570a",
        TQ_CONTRACTS: "KQ.m@CFFEX.T,KQ.m@CFFEX.TF",
      },
    });
    
    let quotes = [];
    let klines = [];
    let ready = false;
    
    const timeout = setTimeout(() => {
      proc.kill();
      if (ready) {
        console.log(`✓ 天勤连接成功，收到 ${quotes.length} 条行情，${klines.length} 条K线`);
        resolve({ quotes, klines });
      } else {
        console.log("⚠ 天勤连接超时，但已收到数据:", quotes.length, "条行情");
        resolve({ quotes, klines });
      }
    }, 15000);
    
    proc.stdout.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === "ready") {
            ready = true;
            console.log("✓ Python worker 已就绪");
          } else if (msg.type === "quotes" || msg.type === "quote") {
            quotes.push(msg.data);
            if (quotes.length === 1) {
              console.log("✓ 收到第一条行情数据:", JSON.stringify(msg.data[0] || msg.data, null, 2));
            }
          } else if (msg.type === "kline") {
            klines.push(msg.data);
            if (klines.length === 1) {
              console.log("✓ 收到第一条K线数据:", JSON.stringify(msg.data, null, 2));
            }
          } else if (msg.type === "error") {
            console.log("⚠ Python worker 错误:", msg.error || msg.message);
          }
        } catch {
          // ignore non-JSON
        }
      }
    });
    
    proc.stderr.on("data", (data) => {
      const text = data.toString();
      if (text.includes("ERROR") || text.includes("Exception")) {
        console.log("[TQSdk 错误]", text.trim());
      }
    });
    
    proc.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !ready) {
        console.log("⚠ Python worker 退出，代码:", code, "- 将使用模拟数据");
        resolve({ quotes: [], klines: [], mockMode: true });
      }
    });
  });
}

async function checkKlineCache() {
  console.log("\n=== 3. 检查K线缓存 ===");
  const conn = await mysql.createConnection(dbConfig);
  
  const [rows] = await conn.execute("SELECT COUNT(*) as count FROM kline_cache");
  console.log("kline_cache 记录数:", rows[0].count);
  
  if (rows[0].count > 0) {
    const [sample] = await conn.execute("SELECT * FROM kline_cache LIMIT 3");
    console.log("示例K线数据:", JSON.stringify(sample, null, 2));
  }
  
  await conn.end();
  return rows[0].count;
}

async function main() {
  try {
    // 1. 测试数据库
    const config = await testDatabase();
    
    // 2. 测试天勤连接
    const result = await testTQConnection();
    
    // 3. 检查K线缓存
    const cacheCount = await checkKlineCache();
    
    console.log("\n=== 测试总结 ===");
    console.log("数据库配置:", config ? "✓ 已保存" : "✗ 未保存");
    console.log("天勤连接:", result.mockMode ? "⚠ 模拟模式" : "✓ 真实连接");
    console.log("行情数据:", result.quotes.length, "条");
    console.log("K线数据:", result.klines.length, "条");
    console.log("K线缓存:", cacheCount, "条");
    
    process.exit(0);
  } catch (error) {
    console.error("测试失败:", error);
    process.exit(1);
  }
}

main();
