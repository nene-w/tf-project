#!/usr/bin/env python3
"""
获取实时 FLAME 框架数据 (修复版)
修复了布伦特原油、美国国债收益率等指标的硬编码问题，接入 AKShare 实时行情接口。
如果无法获取实时数据，将返回 None/null，不再使用过时的静态数值。
"""
import json
from datetime import datetime
import sys
import traceback
import pandas as pd

try:
    import akshare as ak
except ImportError:
    print("[FLAME] 正在安装 akshare...", file=sys.stderr, flush=True)
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "akshare"])
    import akshare as ak

def safe_float(val):
    try:
        if val is None or pd.isna(val):
            return None
        return float(val)
    except:
        return None

def fetch_from_akshare():
    """从 AKShare 获取真实实时数据"""
    data = []
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    # 1. 获取美国国债收益率 & 中国国债收益率 (使用 bond_zh_us_rate 接口)
    try:
        print("[FLAME] 正在获取国债收益率数据...", file=sys.stderr, flush=True)
        us_bond_df = ak.bond_zh_us_rate()
        if not us_bond_df.empty:
            latest = us_bond_df.iloc[-1]
            date = str(latest['日期'])
            
            # 美国2年债
            data.append({
                "dataType": "external",
                "indicator": "美国2年债收益率",
                "value": safe_float(latest['美国国债收益率2年']),
                "unit": "%",
                "releaseDate": date,
                "source": "AKShare/Treasury",
                "description": "美国2年期国债到期收益率"
            })
            # 美国10年债
            data.append({
                "dataType": "external",
                "indicator": "美国10年债收益率",
                "value": safe_float(latest['美国国债收益率10年']),
                "unit": "%",
                "releaseDate": date,
                "source": "AKShare/Treasury",
                "description": "美国10年期国债到期收益率"
            })
            # 中国10年债
            data.append({
                "dataType": "bond_market",
                "indicator": "10Y国债收益率",
                "value": safe_float(latest['中国国债收益率10年']),
                "unit": "%",
                "releaseDate": date,
                "source": "AKShare/Treasury",
                "description": "中国10年期国债到期收益率"
            })
            
            # 计算中美10Y利差
            cn10 = safe_float(latest['中国国债收益率10年'])
            us10 = safe_float(latest['美国国债收益率10年'])
            if cn10 is not None and us10 is not None:
                data.append({
                    "dataType": "external",
                    "indicator": "中美10Y利差",
                    "value": cn10 - us10,
                    "unit": "%",
                    "releaseDate": date,
                    "source": "Calculated",
                    "description": "中国10Y-美国10Y利差"
                })
            print(f"[FLAME] 成功获取收益率数据: US2Y={latest['美国国债收益率2年']}%, CN10Y={latest['中国国债收益率10年']}%", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"[FLAME] 获取收益率数据失败: {e}", file=sys.stderr, flush=True)

    # 2. 获取布伦特原油价格 (使用 futures_foreign_commodity_realtime 接口)
    try:
        print("[FLAME] 正在获取布伦特原油价格...", file=sys.stderr, flush=True)
        oil_df = ak.futures_foreign_commodity_realtime(symbol="OIL")
        if not oil_df.empty:
            brent = oil_df[oil_df['名称'] == '布伦特原油']
            if not brent.empty:
                price = safe_float(brent.iloc[0]['最新价'])
                data.append({
                    "dataType": "external",
                    "indicator": "布伦特原油价格",
                    "value": price,
                    "unit": "美元/桶",
                    "releaseDate": str(brent.iloc[0]['日期']),
                    "source": "AKShare/GlobalFutures",
                    "description": "布伦特原油期货实时价格"
                })
                print(f"[FLAME] 成功获取原油价格: {price} 美元/桶", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"[FLAME] 获取原油价格失败: {e}", file=sys.stderr, flush=True)

    # 3. 获取 PMI (基本面)
    try:
        print("[FLAME] 正在获取制造业PMI...", file=sys.stderr, flush=True)
        pmi_df = ak.macro_china_pmi_yearly()
        if not pmi_df.empty:
            latest = pmi_df.iloc[-1]
            data.append({
                "dataType": "macro",
                "indicator": "制造业PMI",
                "value": safe_float(latest['今值']),
                "unit": "%",
                "releaseDate": str(latest['日期']),
                "source": "国家统计局",
                "description": "官方制造业PMI"
            })
    except Exception as e:
        print(f"[FLAME] 获取PMI失败: {e}", file=sys.stderr, flush=True)

    return data

def get_default_flame_data():
    """获取默认的 FLAME 数据框架 (作为兜底，数值设为 None)"""
    today = datetime.now().strftime('%Y-%m-%d')
    return [
        {"dataType": "macro", "indicator": "制造业PMI", "value": None, "unit": "%", "releaseDate": today, "source": "N/A", "description": "制造业采购经理指数"},
        {"dataType": "macro", "indicator": "CPI同比", "value": None, "unit": "%", "releaseDate": today, "source": "N/A", "description": "居民消费价格指数(同比)"},
        {"dataType": "liquidity", "indicator": "DR007", "value": None, "unit": "%", "releaseDate": today, "source": "N/A", "description": "7天质押式回购加权利率"},
        {"dataType": "external", "indicator": "布伦特原油价格", "value": None, "unit": "美元/桶", "releaseDate": today, "source": "N/A", "description": "布伦特原油价格"},
        {"dataType": "external", "indicator": "美国2年债收益率", "value": None, "unit": "%", "releaseDate": today, "source": "N/A", "description": "美国2年期国债收益率"},
        {"dataType": "bond_market", "indicator": "10Y国债收益率", "value": None, "unit": "%", "releaseDate": today, "source": "N/A", "description": "10年期国债到期收益率"}
    ]

def fetch_flame_data():
    """获取 FLAME 框架数据"""
    print("[FLAME] 开始获取实时 FLAME 数据...", file=sys.stderr, flush=True)
    
    # 获取实时数据
    real_data = fetch_from_akshare()
    
    # 获取默认框架
    default_data = get_default_flame_data()
    
    # 合并数据：用实时数据替换默认框架中的条目
    final_data_dict = { (d['dataType'], d['indicator']): d for d in default_data }
    for d in real_data:
        final_data_dict[(d['dataType'], d['indicator'])] = d
        
    final_data = list(final_data_dict.values())
    print(f"[FLAME] 返回 {len(final_data)} 条 FLAME 数据", file=sys.stderr, flush=True)
    return final_data

if __name__ == '__main__':
    try:
        result = fetch_flame_data()
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        # 输出空框架作为兜底
        print(json.dumps(get_default_flame_data(), ensure_ascii=False, indent=2))
