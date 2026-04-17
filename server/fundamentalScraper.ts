import { createFundamentalData } from './db';

/**
 * 基本面数据抓取服务
 * 已修改：禁用 AKShare 和 iFinD 在线抓取，仅使用本地推送的数据。
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
 * 获取 FLAME 数据
 * 已修改：不再从外部 API 获取，返回空数组。
 * 实际数据通过 /api/upload 接口由本地推送。
 */
export async function fetchFLAMEData(): Promise<FundamentalIndicator[]> {
  console.log('[FundamentalScraper] Online data fetching is disabled. Using local pushed data only.');
  return [];
}

/**
 * 运行所有抓取任务并保存到数据库
 * 已修改：不再执行在线抓取。
 */
export async function runFundamentalScraper() {
  console.log('[FundamentalScraper] Manual refresh disabled. Please use local upload script to sync data.');
  return 0;
}

// 导出空函数以保持兼容性，但不执行任何操作
export async function fetchiFinDData(): Promise<FundamentalIndicator[]> { return []; }
export async function fetchAKShareData(): Promise<FundamentalIndicator[]> { return []; }
