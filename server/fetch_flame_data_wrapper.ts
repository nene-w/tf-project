/**
 * 彻底禁用外部 API 抓取包装器
 * 该文件已被修改为仅返回空数据，以确保系统完全依赖本地推送的数据。
 */

export interface FLAMEData {
  dataType: string;
  indicator: string;
  value: number | null;
  unit?: string;
  releaseDate?: string;
  source: string;
  description?: string;
}

export async function fetchFLAMEData(): Promise<FLAMEData[]> {
  console.log("[System] External API fetching is completely disabled. Please use local upload script.");
  return [];
}

export async function fetchRealtimeFLAMEData(): Promise<FLAMEData[]> {
  console.log("[System] Realtime external API fetching is completely disabled.");
  return [];
}
