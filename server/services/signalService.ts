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
      // 获取所有启用的指标
      // 注意：这里简化处理，实际应按用户分别处理
      // 假设只有一个主用户或系统级监控
      const indicators = await getIndicators(1); // 示例：获取用户ID为1的指标
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
      // 获取K线数据（从TQService获取最新的200根）
      const klines = tqService.getKlines(contract, 60, 200); // 实际应从TQ获取真实数据
      
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
    
    // 记录信号到数据库
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
      const savedRecord = await createSignalRecord(record);
      
      // 发送邮件告警
      const emailConfig = await getEmailConfig(userId);
      if (emailConfig && emailConfig.isEnabled) {
        const emailResult = await sendAlertEmail(emailConfig, record);
        if (emailResult.success) {
          // 更新记录状态（如果需要）
        }
      }
    } catch (error) {
      console.error("[SignalService] Error handling triggered signal:", error);
    }
  }
}

export const signalService = new SignalService();
