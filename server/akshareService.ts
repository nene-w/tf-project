import { execSync } from 'child_process';
import path from 'path';

/**
 * FLAME 数据接口定义
 */
export interface FLAMEDataItem {
  dataType: 'macro' | 'liquidity' | 'bond_market' | 'sentiment' | 'external';
  indicator: string;
  value: number;
  unit?: string;
  releaseDate?: string;
  source: string;
  description?: string;
}

/**
 * 调用 fetch_real_flame_data.py 脚本获取真实 AKShare 数据
 * 
 * @returns 返回 FLAME 数据数组，若执行失败返回空数组
 */
export async function fetchRealFLAMEData(): Promise<FLAMEDataItem[]> {
  try {
    console.log('[AKShareService] 开始执行 fetch_real_flame_data.py...');
    
    // 获取脚本路径（相对于项目根目录）
    const scriptPath = path.join(process.cwd(), 'server', 'fetch_real_flame_data.py');
    
    // 执行 Python 脚本，获取 JSON 输出
    const output = execSync(`python3 "${scriptPath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'], // 捕获 stdout 和 stderr
    });
    
    console.log('[AKShareService] Python 脚本执行成功');
    
    // 解析 JSON 输出
    const data = JSON.parse(output);
    
    if (!Array.isArray(data)) {
      console.warn('[AKShareService] Python 脚本返回非数组数据，降级处理');
      return [];
    }
    
    console.log(`[AKShareService] 成功获取 ${data.length} 条 FLAME 数据`);
    return data as FLAMEDataItem[];
    
  } catch (error) {
    // 降级处理：若 Python 脚本执行失败，返回空数据而非静态数据
    console.error('[AKShareService] 执行 fetch_real_flame_data.py 失败:', error);
    console.warn('[AKShareService] 降级处理：返回空数据');
    return [];
  }
}

/**
 * 验证 FLAME 数据项的完整性
 */
export function validateFLAMEItem(item: any): item is FLAMEDataItem {
  const isValid = (
    item &&
    typeof item === 'object' &&
    ['macro', 'liquidity', 'bond_market', 'sentiment', 'external'].includes(item.dataType) &&
    typeof item.indicator === 'string' &&
    typeof item.value === 'number' &&
    typeof item.source === 'string'
  );
  
  if (!isValid) {
    console.warn('[AKShareService] 数据项验证失败:', item);
  }
  
  return isValid;
}

/**
 * 过滤和验证 FLAME 数据
 */
export function filterValidFLAMEData(data: any[]): FLAMEDataItem[] {
  if (!Array.isArray(data)) {
    return [];
  }
  
  return data.filter((item) => {
    try {
      return validateFLAMEItem(item);
    } catch {
      console.warn('[AKShareService] 跳过无效数据项:', item);
      return false;
    }
  });
}
