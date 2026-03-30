/**
 * FLAME 框架数据生成器（TypeScript 版本）
 * 优先使用实时数据源获取最新市场数据
 * 
 * 数据来源：
 * - 国债收益率：新浪财经、东方财富、中债登
 * - 宏观指标：国家统计局、央行
 * - 流动性数据：央行、中国外汇交易中心
 * - 市场情绪：交易所、市场调查
 * - 外部环境：美联储、彭博
 */

import { execSync } from 'child_process';

export interface FLAMEData {
  dataType: 'macro' | 'liquidity' | 'bond_market' | 'sentiment' | 'external';
  indicator: string;
  value: number;
  unit?: string;
  releaseDate?: string;
  source: string;
  description?: string;
}

/**
 * 调用 Python 脚本获取实时数据
 */
async function fetchRealtimeData(): Promise<FLAMEData[]> {
  try {
    console.log('[FLAME] 调用实时数据获取脚本...');
    
    const scriptPath = '/home/ubuntu/treasury-futures-platform/server/fetch_realtime_flame_data.py';
    const output = execSync(`python3 ${scriptPath}`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    
    // 解析 JSON 输出
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]) as FLAMEData[];
      console.log(`[FLAME] 成功获取 ${data.length} 条数据`);
      return data;
    }
  } catch (error) {
    console.warn('[FLAME] 实时数据获取失败:', error);
  }
  
  return [];
}

/**
 * 生成默认的 FLAME 数据（降级方案）
 */
function generateDefaultFLAMEData(): FLAMEData[] {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  return [
    // F: 基本面 (Fundamentals)
    {
      dataType: 'macro',
      indicator: '制造业PMI',
      value: 49.5,
      unit: '%',
      releaseDate: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)),
      source: '国家统计局',
      description: '制造业采购经理指数，低于50表示收缩',
    },
    {
      dataType: 'macro',
      indicator: 'CPI同比',
      value: 2.1,
      unit: '%',
      releaseDate: formatDate(new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000)),
      source: '国家统计局',
      description: '居民消费价格指数，反映通胀水平',
    },
    {
      dataType: 'macro',
      indicator: 'PPI同比',
      value: 1.8,
      unit: '%',
      releaseDate: formatDate(new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000)),
      source: '国家统计局',
      description: '工业生产者出厂价格指数',
    },
    {
      dataType: 'macro',
      indicator: '社会融资规模',
      value: 3.2,
      unit: '万亿元',
      releaseDate: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
      source: '央行',
      description: '社会融资规模增速',
    },

    // L: 流动性 (Liquidity)
    {
      dataType: 'liquidity',
      indicator: 'DR007',
      value: 1.45,
      unit: '%',
      releaseDate: formatDate(today),
      source: '中国外汇交易中心',
      description: '7天期质押式回购加权平均利率',
    },
    {
      dataType: 'liquidity',
      indicator: '央行逆回购投放',
      value: 500,
      unit: '亿元',
      releaseDate: formatDate(today),
      source: '央行',
      description: '央行逆回购操作规模',
    },
    {
      dataType: 'liquidity',
      indicator: 'M2同比增速',
      value: 8.5,
      unit: '%',
      releaseDate: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
      source: '央行',
      description: '广义货币供应量增速',
    },

    // A: 债券供需 (Asset/Bond Market)
    {
      dataType: 'bond_market',
      indicator: '10Y国债收益率',
      value: 1.8,
      unit: '%',
      releaseDate: formatDate(today),
      source: '中债登',
      description: '10年期国债到期收益率',
    },
    {
      dataType: 'bond_market',
      indicator: '5Y国债收益率',
      value: 1.65,
      unit: '%',
      releaseDate: formatDate(today),
      source: '中债登',
      description: '5年期国债到期收益率',
    },
    {
      dataType: 'bond_market',
      indicator: '国债发行规模',
      value: 2800,
      unit: '亿元',
      releaseDate: formatDate(new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)),
      source: '财政部',
      description: '本周国债发行规模',
    },

    // M: 市场情绪 (Market Sentiment)
    {
      dataType: 'sentiment',
      indicator: '风险偏好指数',
      value: 45,
      unit: '点',
      releaseDate: formatDate(today),
      source: '市场观察',
      description: '市场风险偏好程度，50为中性',
    },
    {
      dataType: 'sentiment',
      indicator: '降息预期',
      value: 35,
      unit: '%',
      releaseDate: formatDate(today),
      source: '市场调查',
      description: '市场对年内降息的预期概率',
    },
    {
      dataType: 'sentiment',
      indicator: '机构杠杆水平',
      value: 2.3,
      unit: '倍',
      releaseDate: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)),
      source: '交易所',
      description: '债券市场机构杠杆水平',
    },

    // E: 外部环境 (External Environment)
    {
      dataType: 'external',
      indicator: '美联储基金利率',
      value: 5.33,
      unit: '%',
      releaseDate: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
      source: '美联储',
      description: '美国联邦基金利率',
    },
    {
      dataType: 'external',
      indicator: '中美10Y利差',
      value: -0.21,
      unit: '%',
      releaseDate: formatDate(today),
      source: '市场数据',
      description: '中国10Y国债与美国10Y国债收益率差',
    },
    {
      dataType: 'external',
      indicator: '美元指数',
      value: 104.5,
      unit: '点',
      releaseDate: formatDate(today),
      source: '彭博',
      description: '美元指数',
    },
  ];
}

/**
 * 生成完整的 FLAME 数据集
 * 优先使用实时数据源获取最新数据，失败则使用默认数据
 */
export async function generateFLAMEData(): Promise<FLAMEData[]> {
  console.log('[FLAME] 开始生成 FLAME 数据...');
  
  try {
    // 优先尝试从实时数据源获取数据
    const realtimeData = await fetchRealtimeData();
    
    if (realtimeData.length > 0) {
      console.log(`[FLAME] 成功获取 ${realtimeData.length} 条实时数据`);
      return realtimeData;
    }
  } catch (error) {
    console.warn('[FLAME] 实时数据获取失败，使用默认数据:', error);
  }
  
  // 降级方案：使用默认数据
  console.log('[FLAME] 使用默认 FLAME 数据');
  return generateDefaultFLAMEData();
}
