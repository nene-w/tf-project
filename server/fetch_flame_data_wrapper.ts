import { fetchAKShareData, FundamentalIndicator } from './fundamentalScraper';

export interface FLAMEData {
  dataType: string;
  indicator: string;
  value: number | null;
  unit?: string;
  releaseDate?: string;
  source: string;
  description?: string;
}

/**
 * 获取 FLAME 数据（调用 Python 实时抓取脚本）
 */
export async function fetchFLAMEData(): Promise<FLAMEData[]> {
  try {
    const data = await fetchAKShareData();
    console.log(`[FLAMEDataWrapper] Successfully fetched ${data.length} real-time FLAME data items`);
    
    return data.map(d => ({
      dataType: d.dataType,
      indicator: d.indicator,
      value: d.value,
      unit: d.unit,
      releaseDate: d.releaseDate ? d.releaseDate.toISOString().split('T')[0] : undefined,
      source: d.source,
      description: d.description,
    }));
  } catch (error) {
    console.error('[FLAMEDataWrapper] Error fetching real-time FLAME data:', error);
    return [];
  }
}
