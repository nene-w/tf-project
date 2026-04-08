import os
os.environ["HTTP_PROXY"] = ""
os.environ["HTTPS_PROXY"] = ""
#!/usr/bin/env python3
"""
使用 AKShare 获取真实 FLAME 框架数据
包含 CPI, PPI, PMI 的同比和环比增速
"""
import json
from datetime import datetime
import sys
import pandas as pd

def fetch_flame_data_akshare():
    """使用 AKShare 获取数据"""
    try:
        import akshare as ak
        print("[FLAME] 尝试使用 AKShare 获取数据...", file=sys.stderr, flush=True)
        
        data = []
        today_str = datetime.now().strftime('%Y-%m-%d')
        
        # 1. 获取国债收益率曲线
        try:
            bond_yield = ak.bond_china_yield()
            if not bond_yield.empty:
                treasury_data = bond_yield[bond_yield['曲线名称'] == '中债国债收益率曲线'].iloc[-1]
                data.append({
                    "dataType": "bond_market",
                    "indicator": "10Y国债收益率",
                    "value": float(treasury_data.get('10年', 0)),
                    "unit": "%",
                    "releaseDate": str(treasury_data.get('日期', today_str)),
                    "source": "中债登",
                    "description": "10年期国债到期收益率"
                })
                data.append({
                    "dataType": "bond_market",
                    "indicator": "5Y国债收益率",
                    "value": float(treasury_data.get('5年', 0)),
                    "unit": "%",
                    "releaseDate": str(treasury_data.get('日期', today_str)),
                    "source": "中债登",
                    "description": "5年期国债到期收益率"
                })
        except Exception as e:
            print(f"[FLAME] AKShare 获取国债收益率失败: {e}", file=sys.stderr, flush=True)
        print("[FLAME] 开始获取 CPI...", file=sys.stderr, flush=True)

        # 2. 获取 CPI (同比 & 环比)
        try:
            cpi_y = ak.macro_china_cpi_yearly()
            if not cpi_y.empty:
                latest = cpi_y.iloc[-1]
                val = latest['今值'] if pd.notnull(latest['今值']) else latest['前值']
                data.append({
                    "dataType": "macro",
                    "indicator": "CPI同比",
                    "value": float(val),
                    "unit": "%",
                    "releaseDate": str(latest['日期']),
                    "source": "国家统计局",
                    "description": "居民消费价格指数(同比)"
                })
            
            cpi_m = ak.macro_china_cpi_monthly()
            if not cpi_m.empty:
                latest = cpi_m.iloc[-1]
                val = latest['今值'] if pd.notnull(latest['今值']) else latest['前值']
                data.append({
                    "dataType": "macro",
                    "indicator": "CPI环比",
                    "value": float(val),
                    "unit": "%",
                    "releaseDate": str(latest['日期']),
                    "source": "国家统计局",
                    "description": "居民消费价格指数(环比)"
                })
        except Exception as e:
            print(f"[FLAME] AKShare 获取 CPI 失败: {e}", file=sys.stderr, flush=True)
        print("[FLAME] 开始获取 PPI...", file=sys.stderr, flush=True)

        # 3. 获取 PPI (同比 & 环比尝试)
        try:
            ppi_y = ak.macro_china_ppi_yearly()
            if not ppi_y.empty:
                latest = ppi_y.iloc[-1]
                val = latest['今值'] if pd.notnull(latest['今值']) else latest['前值']
                data.append({
                    "dataType": "macro",
                    "indicator": "PPI同比",
                    "value": float(val),
                    "unit": "%",
                    "releaseDate": str(latest['日期']),
                    "source": "国家统计局",
                    "description": "工业生产者出厂价格指数(同比)"
                })
            
            # PPI 环比通过 macro_china_qyspjg (企业商品价格指数) 获取作为参考
            qyspjg = ak.macro_china_qyspjg()
            if not qyspjg.empty:
                latest = qyspjg.iloc[0] # 东方财富接口通常最新在第一行
                data.append({
                    "dataType": "macro",
                    "indicator": "PPI环比(参考)",
                    "value": float(latest['总指数-环比增长']),
                    "unit": "%",
                    "releaseDate": datetime.now().strftime('%Y-%m-%d'),
                    "source": "东方财富",
                    "description": "企业商品价格指数(环比)，用作PPI环比参考"
                })
        except Exception as e:
            print(f"[FLAME] AKShare 获取 PPI 失败: {e}", file=sys.stderr, flush=True)
        print("[FLAME] 开始获取 PMI...", file=sys.stderr, flush=True)

        # 4. 获取 PMI
        try:
            pmi = ak.macro_china_pmi_yearly()
            if not pmi.empty:
                latest = pmi.iloc[-1]
                val = latest['今值'] if pd.notnull(latest['今值']) else latest['前值']
                data.append({
                    "dataType": "macro",
                    "indicator": "制造业PMI",
                    "value": float(val),
                    "unit": "%",
                    "releaseDate": str(latest['日期']),
                    "source": "国家统计局",
                    "description": "官方制造业采购经理指数"
                })
        except Exception as e:
            print(f"[FLAME] AKShare 获取 PMI 失败: {e}", file=sys.stderr, flush=True)
        print("[FLAME] 开始获取 DR007...", file=sys.stderr, flush=True)

        # 5. 获取 DR007
        try:
            macro_rate = ak.macro_bank_china_interest_rate()
            if not macro_rate.empty:
                latest = macro_rate.iloc[-1]
                dr007_value = 0
                if '7天期' in latest:
                    dr007_value = float(latest['7天期'])
                data.append({
                    "dataType": "liquidity",
                    "indicator": "DR007",
                    "value": dr007_value,
                    "unit": "%",
                    "releaseDate": today_str,
                    "source": "中国外汇交易中心",
                    "description": "7天期质押式回购加权平均利率"
                })
        except Exception as e:
            print(f"[FLAME] AKShare 获取 DR007 失败: {e}", file=sys.stderr, flush=True)
        print("[FLAME] 所有数据获取尝试完毕。", file=sys.stderr, flush=True)

        return data
    except Exception as e:
        print(f"[FLAME] AKShare 总体获取失败: {e}", file=sys.stderr, flush=True)
        return []

def get_default_data():
    """获取默认数据 - 仅在脚本初始化失败时返回空数组，不返回静态数据"""
    # 根据约束要求，失败时返回空数据而非静态数据
    return []

if __name__ == '__main__':
    try:
        result = fetch_flame_data_akshare()
        # 若获取失败，返回空数组而非静态数据
        if not result:
            result = []
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        # 降级处理：返回空数据而非静态数据
        print(json.dumps([], ensure_ascii=False, indent=2))
