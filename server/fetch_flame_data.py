#!/usr/bin/env python3
"""
FLAME 框架数据抓取脚本
获取基本面、流动性、债券供需、市场情绪、外部环境五个维度的数据
"""

import json
from datetime import datetime
import sys

def fetch_flame_data():
    """
    获取 FLAME 框架数据
    返回格式：List[Dict] 包含 dataType, indicator, value, unit, releaseDate, source, description
    """
    data = []
    now = datetime.now()
    
    # ---------------------------------------------------------
    # F: Fundamental (基本面 - 宏观、通胀)
    # ---------------------------------------------------------
    try:
        # 使用模拟数据（实际环境可替换为 AKShare API 调用）
        data.extend([
            {
                "dataType": "macro",
                "indicator": "制造业PMI",
                "value": 49.5,
                "unit": "%",
                "releaseDate": "2026-03-31",
                "source": "国家统计局",
                "description": "制造业采购经理指数，低于50表示收缩"
            },
            {
                "dataType": "macro",
                "indicator": "CPI同比",
                "value": 2.1,
                "unit": "%",
                "releaseDate": "2026-03-15",
                "source": "国家统计局",
                "description": "居民消费价格指数，反映通胀水平"
            },
            {
                "dataType": "macro",
                "indicator": "PPI同比",
                "value": 1.8,
                "unit": "%",
                "releaseDate": "2026-03-15",
                "source": "国家统计局",
                "description": "工业生产者出厂价格指数"
            }
        ])
    except Exception as e:
        print(f"Error fetching Fundamental data: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # L: Liquidity (流动性 - 央行、资金面)
    # ---------------------------------------------------------
    try:
        data.extend([
            {
                "dataType": "liquidity",
                "indicator": "DR007",
                "value": 2.35,
                "unit": "%",
                "releaseDate": "2026-03-30",
                "source": "中国货币网",
                "description": "银行间存款类机构7天质押式回购利率"
            },
            {
                "dataType": "liquidity",
                "indicator": "7天逆回购利率",
                "value": 2.0,
                "unit": "%",
                "releaseDate": "2026-03-30",
                "source": "人民银行",
                "description": "公开市场操作中标利率"
            },
            {
                "dataType": "liquidity",
                "indicator": "非制造业PMI",
                "value": 52.1,
                "unit": "%",
                "releaseDate": "2026-03-31",
                "source": "国家统计局",
                "description": "非制造业采购经理指数"
            }
        ])
    except Exception as e:
        print(f"Error fetching Liquidity data: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # A: Allocation (债券供需 - 利率债、发行)
    # ---------------------------------------------------------
    try:
        data.extend([
            {
                "dataType": "bond_market",
                "indicator": "10Y国债收益率",
                "value": 3.12,
                "unit": "%",
                "releaseDate": "2026-03-30",
                "source": "中债估值",
                "description": "10年期国债到期收益率"
            },
            {
                "dataType": "bond_market",
                "indicator": "5Y国债收益率",
                "value": 2.94,
                "unit": "%",
                "releaseDate": "2026-03-30",
                "source": "中债估值",
                "description": "5年期国债到期收益率"
            },
            {
                "dataType": "bond_market",
                "indicator": "2Y国债收益率",
                "value": 2.45,
                "unit": "%",
                "releaseDate": "2026-03-30",
                "source": "中债估值",
                "description": "2年期国债到期收益率"
            }
        ])
    except Exception as e:
        print(f"Error fetching Allocation data: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # M: Market Sentiment (市场情绪 - 预期、杠杆)
    # ---------------------------------------------------------
    try:
        data.extend([
            {
                "dataType": "sentiment",
                "indicator": "10Y-5Y利差",
                "value": 18.0,
                "unit": "BP",
                "releaseDate": "2026-03-30",
                "source": "中债估值",
                "description": "中期利差，反映市场对中长端利率的预期"
            },
            {
                "dataType": "sentiment",
                "indicator": "30Y-10Y利差",
                "value": 59.7,
                "unit": "BP",
                "releaseDate": "2026-03-30",
                "source": "中债估值",
                "description": "期限利差，反映市场对长端利率的预期"
            },
            {
                "dataType": "sentiment",
                "indicator": "5Y-2Y利差",
                "value": 49.0,
                "unit": "BP",
                "releaseDate": "2026-03-30",
                "source": "中债估值",
                "description": "短期利差"
            }
        ])
    except Exception as e:
        print(f"Error fetching Sentiment data: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # E: External Environment (外部环境 - 汇率、美债)
    # ---------------------------------------------------------
    try:
        data.extend([
            {
                "dataType": "external",
                "indicator": "USD/CNY汇率",
                "value": 7.28,
                "unit": "",
                "releaseDate": "2026-03-30",
                "source": "中国银行",
                "description": "美元兑人民币中间价"
            },
            {
                "dataType": "external",
                "indicator": "美国10Y国债收益率",
                "value": 4.15,
                "unit": "%",
                "releaseDate": "2026-03-30",
                "source": "美国财政部",
                "description": "美国10年期国债收益率"
            }
        ])
    except Exception as e:
        print(f"Error fetching External data: {e}", file=sys.stderr)

    return data

if __name__ == "__main__":
    flame_data = fetch_flame_data()
    print(json.dumps(flame_data, ensure_ascii=False, indent=2))
