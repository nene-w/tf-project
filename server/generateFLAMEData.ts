/**
 * FLAME 框架数据生成器（TypeScript 版本）
 * 避免 Python 环境问题，直接在 Node.js 中生成数据
 */

export interface FLAMEData {
  dataType: 'macro' | 'liquidity' | 'bond_market' | 'sentiment' | 'external';
  indicator: string;
  value: number;
  unit?: string;
  releaseDate?: string;
  source: string;
  description?: string;
}

export function generateFLAMEData(): FLAMEData[] {
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
      value: 1.85,
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
      value: 3.12,
      unit: '%',
      releaseDate: formatDate(today),
      source: '中债登',
      description: '10年期国债到期收益率',
    },
    {
      dataType: 'bond_market',
      indicator: '5Y国债收益率',
      value: 2.94,
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
