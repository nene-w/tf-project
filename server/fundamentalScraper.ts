import { createFundamentalData } from './db';
import { generateFLAMEData } from './generateFLAMEData';

/**
 * 基本面数据抓取服务
 * 负责获取宏观经济指标、资金面、利率债供需、市场情绪及外部环境数据
 * 使用 TypeScript 生成器避免 Python 环境问题
 */

export interface FundamentalIndicator {
  dataType: string;
  indicator: string;
  value: number;
  unit?: string;
  releaseDate?: Date;
  source: string;
  description?: string;
}

/**
 * 获取 FLAME 数据（使用 TypeScript 生成器）
 */
export async function fetchAKShareData(): Promise<FundamentalIndicator[]> {
  try {
    const data = await generateFLAMEData();
    return data.map((d: any) => ({
      dataType: d.dataType,
      indicator: d.indicator,
      value: d.value,
      unit: d.unit,
      releaseDate: d.releaseDate ? new Date(d.releaseDate) : new Date(),
      source: d.source,
      description: d.description,
    }));
  } catch (error) {
    console.error('[FundamentalScraper] Error generating FLAME data:', error);
    throw error;
  }
}

/**
 * 运行所有抓取任务并保存到数据库
 */
export async function runFundamentalScraper() {
  console.log('[FundamentalScraper] Starting FLAME data fetch...');
  
  try {
    const allData = await fetchAKShareData();
    let count = 0;
    
    for (const item of allData) {
      try {
        await createFundamentalData({
          dataType: item.dataType,
          indicator: item.indicator,
          value: String(item.value),
          unit: item.unit,
          releaseDate: item.releaseDate ? new Date(item.releaseDate) : new Date(),
          source: item.source,
          description: item.description,
        });
        count++;
      } catch (e) {
        console.error(`[FundamentalScraper] Failed to save ${item.indicator}:`, e);
      }
    }
    
    console.log(`[FundamentalScraper] Successfully saved ${count} indicators.`);
    return count;
  } catch (error) {
    console.error('[FundamentalScraper] Error in runFundamentalScraper:', error);
    // 返回 0 而不是抛出错误，这样 generateFlame 接口不会因为数据抓取失败而完全失败
    return 0;
  }
}
