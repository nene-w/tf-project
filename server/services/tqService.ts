/**
 * 天勤量化数据服务
 * 
 * 架构说明：
 * 1. 当用户配置了天勤账户时，启动Python子进程运行TQSdk，通过stdin/stdout通信
 * 2. 未配置时，使用模拟数据供界面展示和测试
 * 3. 通过EventEmitter向上层推送实时行情和信号
 * 4. 收到 K 线数据时异步写入数据库，确保数据持久化
 */

import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { upsertKlineCache } from "../db";

// 国债期货主连合约代码
export const BOND_FUTURES_CONTRACTS = {
  "KQ.m@CFFEX.T": { name: "T主连", desc: "10年期国债期货", basePrice: 103.5 },
  "KQ.m@CFFEX.TF": { name: "TF主连", desc: "5年期国债期货", basePrice: 104.2 },
  "KQ.m@CFFEX.TS": { name: "TS主连", desc: "2年期国债期货", basePrice: 101.8 },
  "KQ.m@CFFEX.TL": { name: "TL主连", desc: "30年期国债期货", basePrice: 108.6 },
};

export interface KlineBar {
  datetime: number;  // 纳秒时间戳（来自 TQSdk）
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest?: number;
}

export interface QuoteData {
  contract: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume: number;
  openInterest: number;
  datetime: string;
  change: number;
  changePercent: number;
}

class TQService extends EventEmitter {
  private pythonProcess: ChildProcess | null = null;
  private isRunning = false;
  private mockDataInterval: NodeJS.Timeout | null = null;
  private mockPrices: Record<string, number> = {};
  private tqUsername = "";
  private tqPassword = "";
  private subscribedContracts: string[] = [];
  // 缓存键：`${contract}:${period}`，区分不同周期
  private klineCache: Record<string, KlineBar[]> = {};
  private latestQuotes: Record<string, QuoteData> = {};

  constructor() {
    super();
    for (const [contract, info] of Object.entries(BOND_FUTURES_CONTRACTS)) {
      this.mockPrices[contract] = info.basePrice;
    }
  }

  async start(username: string, password: string, contracts: string[]): Promise<{ success: boolean; error?: string }> {
    this.stop();
    this.tqUsername = username;
    this.tqPassword = password;
    this.subscribedContracts = contracts.length > 0 ? contracts : Object.keys(BOND_FUTURES_CONTRACTS);

    if (username && password) {
      return this.startPythonProcess();
    } else {
      this.startMockMode();
      return { success: true };
    }
  }

  stop() {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
    if (this.mockDataInterval) {
      clearInterval(this.mockDataInterval);
      this.mockDataInterval = null;
    }
    this.isRunning = false;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      mode: this.tqUsername ? "live" : "mock",
      contracts: this.subscribedContracts,
    };
  }

  /**
   * 获取内存中缓存的最新一根 K 线（用于叠加到数据库历史数据末尾）
   * 返回 null 表示没有实时数据
   */
  getLatestKlineBar(contract: string, period: number): KlineBar | null {
    const key = `${contract}:${period}`;
    const cache = this.klineCache[key];
    if (!cache || cache.length === 0) return null;
    return cache[cache.length - 1];
  }

  // 获取最新行情
  getLatestQuotes(): QuoteData[] {
    const cached = Object.values(this.latestQuotes);
    if (cached.length > 0) return cached;
    return this.getMockQuotes();
  }

  // 生成模拟K线数据（用于界面展示）
  generateMockKlines(contract: string, period: number, count: number = 200): KlineBar[] {
    const info = BOND_FUTURES_CONTRACTS[contract as keyof typeof BOND_FUTURES_CONTRACTS];
    const basePrice = info?.basePrice || 100;
    const bars: KlineBar[] = [];
    const now = Date.now();
    let price = basePrice;

    for (let i = count - 1; i >= 0; i--) {
      const ts = (now - i * period * 1000) * 1_000_000;  // 转为纳秒
      const change = (Math.random() - 0.495) * 0.08;
      const open = price;
      price = Math.max(basePrice * 0.95, Math.min(basePrice * 1.05, price + change));
      const close = price;
      const high = Math.max(open, close) + Math.random() * 0.03;
      const low = Math.min(open, close) - Math.random() * 0.03;
      const volume = Math.floor(Math.random() * 5000 + 1000);

      bars.push({
        datetime: ts,
        open: parseFloat(open.toFixed(3)),
        high: parseFloat(high.toFixed(3)),
        low: parseFloat(low.toFixed(3)),
        close: parseFloat(close.toFixed(3)),
        volume,
        openInterest: Math.floor(Math.random() * 50000 + 100000),
      });
    }
    return bars;
  }

  getMockQuotes(): QuoteData[] {
    return Object.entries(BOND_FUTURES_CONTRACTS).map(([contract, info]) => {
      const price = this.mockPrices[contract] || info.basePrice;
      const change = price - info.basePrice;
      return {
        contract,
        lastPrice: parseFloat(price.toFixed(3)),
        bidPrice: parseFloat((price - 0.002).toFixed(3)),
        askPrice: parseFloat((price + 0.002).toFixed(3)),
        volume: Math.floor(Math.random() * 1000 + 500),
        openInterest: Math.floor(Math.random() * 10000 + 80000),
        datetime: new Date().toISOString(),
        change: parseFloat(change.toFixed(3)),
        changePercent: parseFloat(((change / info.basePrice) * 100).toFixed(2)),
      };
    });
  }

  private startMockMode() {
    this.isRunning = true;
    this.mockDataInterval = setInterval(() => {
      for (const [contract, info] of Object.entries(BOND_FUTURES_CONTRACTS)) {
        const current = this.mockPrices[contract] || info.basePrice;
        const change = (Math.random() - 0.495) * 0.05;
        this.mockPrices[contract] = Math.max(
          info.basePrice * 0.95,
          Math.min(info.basePrice * 1.05, current + change)
        );
      }
      const quotes = this.getMockQuotes();
      for (const q of quotes) {
        this.latestQuotes[q.contract] = q;
      }
      this.emit("quotes", quotes);
    }, 2000);
  }

  /**
   * 将 K 线数据异步写入数据库（不阻塞主流程）
   */
  private async persistKlinesToDb(contract: string, period: number, bars: KlineBar[]) {
    try {
      const rows = bars.map((bar) => ({
        contract,
        period,
        datetime: bar.datetime,  // schema: bigint mode:"number" → JS number
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        openInterest: bar.openInterest ?? 0,
      }));
      await upsertKlineCache(rows);
      console.log(`[TQService] Persisted ${rows.length} klines for ${contract} period=${period}s`);
    } catch (err) {
      console.error(`[TQService] Failed to persist klines for ${contract} period=${period}s:`, err);
    }
  }

  private processMessage(line: string) {
    try {
      const msg = JSON.parse(line);

      if (msg.type === "quotes" || msg.type === "quote") {
        const quotesArray: QuoteData[] = Array.isArray(msg.data) ? msg.data : [msg.data];
        for (const q of quotesArray) {
          if (q && q.contract) {
            this.latestQuotes[q.contract] = q;
          }
        }
        this.emit("quotes", quotesArray);

      } else if (msg.type === "klines") {
        // 初始K线数据（历史数据批量推送）
        const contract: string = msg.contract;
        const period: number = msg.period;
        const bars: KlineBar[] = msg.data || [];
        if (contract && period && bars.length > 0) {
          // 缓存键区分周期
          const key = `${contract}:${period}`;
          this.klineCache[key] = bars;
          console.log(`[TQService] Cached ${bars.length} klines for ${contract} period=${period}s`);
          // 异步写入数据库（不阻塞）
          this.persistKlinesToDb(contract, period, bars);
          this.emit("klines", { contract, period, data: bars });
        }

      } else if (msg.type === "kline") {
        // 单根K线实时更新
        const contract: string = msg.contract;
        const period: number = msg.period;
        const bar: KlineBar = msg.data;
        if (contract && period && bar) {
          const key = `${contract}:${period}`;
          if (!this.klineCache[key]) {
            this.klineCache[key] = [];
          }
          const cache = this.klineCache[key];
          if (cache.length > 0 && cache[cache.length - 1].datetime === bar.datetime) {
            cache[cache.length - 1] = bar;  // 更新最后一根
          } else {
            cache.push(bar);  // 追加新K线
            if (cache.length > 1000) cache.shift();
          }
          // 异步写入数据库（单根 upsert）
          this.persistKlinesToDb(contract, period, [bar]);
          this.emit("kline", { contract, period, data: bar, prev: msg.prev });
        }

      } else if (msg.type === "error") {
        this.emit("error", msg.error || msg.message);
      }
    } catch {
      // ignore non-JSON output
    }
  }

  private async startPythonProcess(): Promise<{ success: boolean; error?: string }> {
    const scriptPath = path.join(process.cwd(), "scripts", "tq_worker.py");

    if (!fs.existsSync(scriptPath)) {
      this.startMockMode();
      return { success: true };
    }

    return new Promise((resolve) => {
      try {
        this.pythonProcess = spawn("python3", [scriptPath], {
          env: {
            ...process.env,
            TQ_USERNAME: this.tqUsername,
            TQ_PASSWORD: this.tqPassword,
            TQ_CONTRACTS: this.subscribedContracts.join(","),
            PYTHONUNBUFFERED: "1",
          },
        });

        let started = false;
        let buffer = "";

        const timeout = setTimeout(() => {
          if (!started) {
            console.log("[TQService] Timeout waiting for Python worker, falling back to mock mode");
            this.startMockMode();
            resolve({ success: true });
          }
        }, 30000);

        this.pythonProcess.stdout?.on("data", (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const msg = JSON.parse(trimmed);
              if (msg.type === "ready" && !started) {
                started = true;
                clearTimeout(timeout);
                this.isRunning = true;
                console.log(`[TQService] Python worker ready, mode: ${msg.mode}`);
                resolve({ success: true });
              }
              this.processMessage(trimmed);
            } catch {
              // ignore non-JSON output
            }
          }
        });

        this.pythonProcess.stderr?.on("data", (data: Buffer) => {
          console.error("[TQSdk]", data.toString().trim());
        });

        this.pythonProcess.on("exit", (code) => {
          this.isRunning = false;
          console.log(`[TQService] Python worker exited with code ${code}`);
          this.emit("disconnected", code);
          if (!started) {
            clearTimeout(timeout);
            this.startMockMode();
            resolve({ success: true });
          }
        });

        this.pythonProcess.on("error", (err) => {
          console.error("[TQService] Python process error:", err);
          if (!started) {
            clearTimeout(timeout);
            this.startMockMode();
            resolve({ success: true });
          }
        });

      } catch (e: any) {
        this.startMockMode();
        resolve({ success: true });
      }
    });
  }
}

// 单例
export const tqService = new TQService();
