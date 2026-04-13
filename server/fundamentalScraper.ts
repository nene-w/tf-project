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
 * 支持两种数据源：AKShare 和 iFinD
 */
export async function fetchFLAMEData(): Promise<FundamentalIndicator[]> {
  const dataSource = process.env.FLAME_DATA_SOURCE || 'ifind'; // 默认使用 iFinD
  
  if (dataSource === 'ifind') {
    return fetchiFinDData();
  } else {
    return fetchAKShareData();
  }
}

/**
 * 获取 iFinD 数据（推荐用于生产环境）
 */
export async function fetchiFinDData(): Promise<FundamentalIndicator[]> {
  try {
    const scriptPath = path.join(__dirname, 'fetch_realtime_flame_data_ifind_token.py');
    console.log(`[FundamentalScraper] Executing iFinD script: ${scriptPath}`);
    
    // 从环境变量读取 iFinD token
    const ifindToken = process.env.IFIND_TOKEN;
    if (!ifindToken) {
      throw new Error('IFIND_TOKEN environment variable not set');
    }
    
    // 尝试使用 python3 或 python 执行
    let stdout, stderr;
    try {
      const result = await execAsync(`IFIND_TOKEN="${ifindToken}" python3 ${scriptPath}`);
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (e: any) {
      console.warn('[FundamentalScraper] python3 failed, trying python...', e.message);
      const result = await execAsync(`IFIND_TOKEN="${ifindToken}" python ${scriptPath}`);
      stdout = result.stdout;
      stderr = result.stderr;
    }
    
    if (!stdout) {
      console.error('[FundamentalScraper] iFinD script produced no output. Stderr:', stderr);
      throw new Error('iFinD script produced no output');
    }

    // 过滤掉 stdout 中的非 JSON 内容（如果有的话）
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : stdout;

    const response = JSON.parse(jsonStr);
    
    // 处理 iFinD 响应格式
    if (response.error) {
      console.error('[FundamentalScraper] iFinD error:', response.error);
      throw new Error(`iFinD error: ${response.error}`);
    }
    
    const indicators = response.indicators || [];
    return indicators.map((d: any) => ({
      dataType: d.dataType,
      indicator: d.name,
      value: d.value,
      unit: d.unit,
      releaseDate: d.releaseDate ? new Date(d.releaseDate) : undefined,
      source: d.source,
      description: d.error ? `[iFinD 错误] ${d.error}` : `[实时数据] ${d.name} (更新日期: ${d.releaseDate || 'N/A'})`,
    }));
  } catch (error) {
    console.error('[FundamentalScraper] Error fetching data from iFinD:', error);
    throw error;
  }
}

/**
 * 获取 AKShare 数据（备选方案，仅在生产环境网络允许时使用）
 */
export async function fetchAKShareData(): Promise<FundamentalIndicator[]> {
  try {
    const scriptPath = path.join(__dirname, 'fetch_realtime_flame_data.py');
    console.log(`[FundamentalScraper] Executing AKShare script: ${scriptPath}`);
    
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
      console.error('[FundamentalScraper] AKShare script produced no output. Stderr:', stderr);
      throw new Error('AKShare script produced no output');
    }

    // 过滤掉 stdout 中的非 JSON 内容（如果有的话）
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : stdout;

    const response = JSON.parse(jsonStr);
    
    if (response.error) {
      console.error('[FundamentalScraper] AKShare error:', response.error);
      throw new Error(`AKShare error: ${response.error}`);
    }
    
    const data = response.indicators || [];
    return data.map((d: any) => ({
      dataType: d.dataType,
      indicator: d.name,
      value: d.value,
      unit: d.unit,
      releaseDate: d.releaseDate ? new Date(d.releaseDate) : undefined,
      source: d.source,
      description: d.error ? `[AKShare 错误] ${d.error}` : `[实时数据] ${d.name} (更新日期: ${d.releaseDate || 'N/A'})`,
    }));
  } catch (error) {
    console.error('[FundamentalScraper] Error fetching data from AKShare:', error);
    throw error;
  }
}

/**
 * 运行所有抓取任务并保存到数据库
 */
export async function runFundamentalScraper() {
  const dataSource = process.env.FLAME_DATA_SOURCE || 'ifind';
  console.log(`[FundamentalScraper] Starting FLAME data fetch from ${dataSource}...`);
  
  try {
    const allData = await fetchFLAMEData();
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
