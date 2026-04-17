/**
 * 彻底禁用基本面抓取逻辑
 * 该文件已被修改为仅返回空数据，以确保系统完全依赖本地推送的数据。
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

export async function fetchAKShareData(): Promise<FundamentalIndicator[]> {
  console.log("[System] AKShare fetching is completely disabled.");
  return [];
}

export async function fetchFLAMEData(): Promise<FundamentalIndicator[]> {
  console.log("[System] FLAME data fetching is completely disabled.");
  return [];
}

export async function runFundamentalScraper(): Promise<number> {
  console.log("[System] Fundamental scraper is completely disabled.");
  return 0;
}

export async function fetchiFinDData(): Promise<FundamentalIndicator[]> {
  return [];
}
