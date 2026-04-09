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
    
    // 尝试使用 python3 或 python 执行
    let stdout, stderr;
    try {
      const result = await execAsync(`python3 ${scriptPath}`);
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (e: any) {
      console.warn('[FundamentalScraper] python3 failed, trying python...', e.message);
      const result = await execAsync(`python ${scriptPath}`);
      stdout = result.stdout;
      stderr = result.stderr;
    }
    
    if (!stdout) {
      console.error('[FundamentalScraper] Python script produced no output. Stderr:', stderr);
      throw new Error('Python script produced no output');
    }

    // 过滤掉 stdout 中的非 JSON 内容（如果有的话）
    const jsonMatch = stdout.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : stdout;

    const data = JSON.parse(jsonStr);
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
