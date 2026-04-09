/**
 * FLAME 框架数据生成器（已禁用静态 Mock，切换为实时抓取）
 */

export interface FLAMEData {
  dataType: 'macro' | 'liquidity' | 'bond_market' | 'sentiment' | 'external';
  indicator: string;
  value: number | null;
  unit?: string;
  releaseDate?: string;
  source: string;
  description?: string;
}

/**
 * 生成最新的 FLAME 数据集
 * 注意：此函数现在返回空数组，强制系统使用 Python 实时抓取脚本。
 */
export async function generateFLAMEData(): Promise<FLAMEData[]> {
  console.log('[FLAME] 静态 Mock 数据生成器已禁用，请使用实时抓取服务。');
  return [];
}
