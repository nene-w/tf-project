import { spawn } from 'child_process';
import path from 'path';
import { createFundamentalData } from './db';

/**
 * 基本面数据抓取服务 (AKShare 版)
 * 负责获取宏观经济指标、资金面、利率债供需、市场情绪及外部环境数据
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
 * 调用 Python 脚本获取 AKShare 数据
 */
export async function fetchAKShareData(): Promise<FundamentalIndicator[]> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'server', 'fetch_flame_data.py');
    const pythonProcess = spawn('python3', [pythonScript]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[FundamentalScraper] Python process failed with code ${code}:`, stderrData);
        reject(new Error(`Python script failed: ${stderrData}`));
        return;
      }

      try {
        const indicators = JSON.parse(stdoutData);
        resolve(indicators);
      } catch (error) {
        console.error('[FundamentalScraper] Failed to parse Python output:', error);
        reject(error);
      }
    });
  });
}

/**
 * 运行所有抓取任务并保存到数据库
 */
export async function runFundamentalScraper() {
  console.log('[FundamentalScraper] Starting AKShare data fetch...');
  
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
    
    console.log(`[FundamentalScraper] Successfully saved ${count} indicators from AKShare.`);
    return count;
  } catch (error) {
    console.error('[FundamentalScraper] Error in runFundamentalScraper:', error);
    return 0;
  }
}
