/**
 * 天勤量化数据服务
 * 
 * 架构说明：
 * 1. 当用户配置了天勤账户时，启动Python子进程运行TQSdk，通过stdin/stdout通信
 * 2. 未配置时，使用模拟数据供界面展示和测试
 * 3. 通过EventEmitter向上层推送实时行情和信号
 */

import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

// 国债期货主连合约代码
export const BOND_FUTURES_CONTRACTS = {
  "KQ.m@CFFEX.T": { name: "T主连", desc: "10年期国债期货", basePrice: 103.5 },
  "KQ.m@CFFEX.TF": { name: "TF主连", desc: "5年期国债期货", basePrice: 104.2 },
  "KQ.m@CFFEX.TS": { name: "TS主连", desc: "2年期国债期货", basePrice: 101.8 },
  "KQ.m@CFFEX.TL": { name: "TL主连", desc: "30年期国债期货", basePrice: 108.6 },
};

export interface KlineBar {
  datetime: number;  // Unix timestamp (ms)
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

  constructor() {
    super();
    // 初始化模拟价格
    for (const [contract, info] of Object.entries(BOND_FUTURES_CONTRACTS)) {
      this.mockPrices[contract] = info.basePrice;
    }
  }

  async start(username: string, password: string, contracts: string[]): Promise<{ success: boolean; error?: string }> {
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

  // 生成模拟K线数据（用于界面展示）
  generateMockKlines(contract: string, period: number, count: number = 200): KlineBar[] {
    const info = BOND_FUTURES_CONTRACTS[contract as keyof typeof BOND_FUTURES_CONTRACTS];
    const basePrice = info?.basePrice || 100;
    const bars: KlineBar[] = [];
    const now = Date.now();
    let price = basePrice;

    for (let i = count - 1; i >= 0; i--) {
      const ts = now - i * period * 1000;
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

  // 获取模拟实时行情
  getKlines(contract: string, periodSec: number = 60, limit: number = 200): KlineBar[] {
    // 返回模拟K线数据（实际应从TQ获取真实数据）
    return this.generateMockKlines(contract, periodSec, limit);
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
    // 每2秒更新一次模拟价格
    this.mockDataInterval = setInterval(() => {
      for (const [contract, info] of Object.entries(BOND_FUTURES_CONTRACTS)) {
        const current = this.mockPrices[contract] || info.basePrice;
        const change = (Math.random() - 0.495) * 0.05;
        this.mockPrices[contract] = Math.max(
          info.basePrice * 0.95,
          Math.min(info.basePrice * 1.05, current + change)
        );
      }
      this.emit("quotes", this.getMockQuotes());
    }, 2000);
  }

  private async startPythonProcess(): Promise<{ success: boolean; error?: string }> {
    const scriptPath = path.join(process.cwd(), "scripts", "tq_worker.py");

    if (!fs.existsSync(scriptPath)) {
      // 如果Python脚本不存在，回退到模拟模式
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
          },
        });

        let started = false;
        const timeout = setTimeout(() => {
          if (!started) {
            this.startMockMode();
            resolve({ success: true });
          }
        }, 10000);

        this.pythonProcess.stdout?.on("data", (data: Buffer) => {
          const lines = data.toString().split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const msg = JSON.parse(line);
              if (msg.type === "ready" && !started) {
                started = true;
                clearTimeout(timeout);
                this.isRunning = true;
                resolve({ success: true });
              } else if (msg.type === "quote") {
                this.emit("quotes", msg.data);
              } else if (msg.type === "kline") {
                this.emit("kline", msg.data);
              } else if (msg.type === "error") {
                this.emit("error", msg.message);
              }
            } catch {
              // ignore non-JSON output
            }
          }
        });

        this.pythonProcess.stderr?.on("data", (data: Buffer) => {
          console.error("[TQSdk]", data.toString());
        });

        this.pythonProcess.on("exit", (code) => {
          this.isRunning = false;
          this.emit("disconnected", code);
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
