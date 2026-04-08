import { createFundamentalData } from './db';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * 基本面数据抓取服务
 * 负责获取宏观经济指标、资金面、利率债供需、市场情绪及外部环境数据
 * 切换为调用 Python 实时抓取脚本，确保数据真实性
 */

export interface FundamentalIndicator {
  dataType: string;
  indicator: string;
  value: number | null;
  unit?: string;
  releaseDate?: Date;
  source: string;
  description?: string;
}

/**
 * 获取 FLAME 数据（调用 Python 脚本）
 */
export async function fetchAKShareData(): Promise<FundamentalIndicator[]> {
  try {
    const scriptPath = path.join(__dirname, 'fetch_realtime_flame_data.py');
    console.log(`[FundamentalScraper] Executing Python script: ${scriptPath}`);
    
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`);
    
    if (stderr && !stdout) {
      console.error('[FundamentalScraper] Python script error:', stderr);
      throw new Error(stderr);
    }

    const data = JSON.parse(stdout);
    return data.map((d: any) => ({
      dataType: d.dataType,
      indicator: d.indicator,
      value: d.value,
      unit: d.unit,
      releaseDate: d.releaseDate ? new Date(d.releaseDate) : undefined,
      source: d.source,
      description: d.description || `[实时数据] ${d.indicator} (更新日期: ${d.releaseDate || 'N/A'})`,
    }));
  } catch (error) {
    console.error('[FundamentalScraper] Error fetching data from Python:', error);
    throw error;
  }
}

/**
 * 运行所有抓取任务并保存到数据库
 */
export async function runFundamentalScraper() {
  console.log('[FundamentalScraper] Starting FLAME data fetch from Python...');
  
  try {
    const allData = await fetchAKShareData();
    let count = 0;
    
    for (const item of allData) {
      try {
        await createFundamentalData({
          dataType: item.dataType,
          indicator: item.indicator,
          value: item.value !== null ? String(item.value) : null,
          unit: item.unit,
          releaseDate: item.releaseDate,
          source: item.source,
          description: item.description,
        });
        count++;
      } catch (e) {
        console.error(`[FundamentalScraper] Failed to save ${item.indicator}:`, e);
      }
    }
    
    console.log(`[FundamentalScraper] Successfully upserted ${count} indicators.`);
    return count;
  } catch (error) {
    console.error('[FundamentalScraper] Error in runFundamentalScraper:', error);
    return 0;
  }
}
