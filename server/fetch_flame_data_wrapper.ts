import { generateFLAMEData } from './generateFLAMEData';

export interface FLAMEData {
  dataType: string;
  indicator: string;
  value: number;
  unit?: string;
  releaseDate?: string;
  source: string;
  description?: string;
}

/**
 * 获取 FLAME 数据（使用 TypeScript 生成器）
 */
export async function fetchFLAMEData(): Promise<FLAMEData[]> {
  try {
    const data = generateFLAMEData();
    console.log(`[FLAMEDataWrapper] Successfully generated ${data.length} FLAME data items`);
    return data;
  } catch (error) {
    console.error('[FLAMEDataWrapper] Error generating FLAME data:', error);
    return [];
  }
}
