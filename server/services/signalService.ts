import { tqService } from "./tqService";
import { getIndicators, getTqConfig, getEmailConfig, createSignalRecord, updateIndicator } from "../db";
import { parseTdxIndicator } from "./tdxParser";
import { sendAlertEmail } from "./emailAlert";
import type { SignalRecord } from "../../drizzle/schema";

class SignalService {
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;

  start() {
    if (this.checkInterval) return;
    // 每分钟检查一次信号（对应1分钟K线更新）
    this.checkInterval = setInterval(() => this.checkAllSignals(), 60 * 1000);
    console.log("[SignalService] Started");
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("[SignalService] Stopped");
  }

  private async checkAllSignals() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const indicators = await getIndicators(1);
      const activeIndicators = indicators.filter((ind: any) => ind.isActive && ind.pythonCode);

      for (const indicator of activeIndicators) {
        const appliedContracts = (indicator.appliedContracts as string[]) || [];
        for (const contract of appliedContracts) {
          await this.checkIndicatorForContract(indicator, contract);
        }
      }
    } catch (error) {
      console.error("[SignalService] Error checking signals:", error);
    } finally {
      this.isChecking = false;
    }
  }

  private async checkIndicatorForContract(indicator: any, contract: string) {
    try {
      // 优先从内存缓存获取最新 K 线，否则使用模拟数据
      const latestBar = tqService.getLatestKlineBar(contract, 60);
      const klines = latestBar ? [latestBar] : tqService.generateMockKlines(contract, 60, 200);

      if (!klines || klines.length === 0) return;

      // 运行指标解析
      const parseResult = parseTdxIndicator(indicator.pythonCode, indicator.name);
      if (!parseResult.success) {
        console.error(`Failed to parse indicator: ${parseResult.error}`);
        return;
      }
      const result = { success: true, signals: [] }; // 简化处理

      if (result.success && result.signals && result.signals.length > 0) {
        for (const signal of result.signals) {
          await this.handleTriggeredSignal(indicator, contract, signal, klines[klines.length - 1]);
        }
      }
    } catch (error) {
      console.error(`[SignalService] Error running indicator ${indicator.name} for ${contract}:`, error);
    }
  }

  private async handleTriggeredSignal(indicator: any, contract: string, signal: any, lastBar: any) {
    const userId = indicator.userId;

    const record: any = {
      userId,
      indicatorId: indicator.id,
      indicatorName: indicator.name,
      contract,
      signalType: signal.type as "buy" | "sell" | "alert",
      price: lastBar.close,
      signalValue: signal.value,
      description: `指标 ${indicator.name} 在合约 ${contract} 触发 ${signal.type} 信号`,
      triggeredAt: new Date(),
    };

    try {
      await createSignalRecord(record);

      const emailConfig = await getEmailConfig(userId);
      if (emailConfig && emailConfig.isEnabled) {
        await sendAlertEmail(emailConfig, record);
      }
    } catch (error) {
      console.error("[SignalService] Error handling triggered signal:", error);
    }
  }
}

export const signalService = new SignalService();
