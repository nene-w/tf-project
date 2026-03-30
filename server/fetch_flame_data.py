import akshare as ak
import pandas as pd
import json
from datetime import datetime, timedelta
import sys

def fetch_flame_data():
    data = []
    now = datetime.now()
    
    # ---------------------------------------------------------
    # F: Fundamental (基本面 - 宏观、通胀)
    # ---------------------------------------------------------
    try:
        # 1. 制造业 PMI
        pmi_df = ak.macro_china_pmi_pbc()
        if not pmi_df.empty:
            latest = pmi_df.iloc[-1]
            data.append({
                "dataType": "macro",
                "indicator": "制造业PMI",
                "value": float(latest['制造业-指数']),
                "unit": "%",
                "releaseDate": str(latest['月份']),
                "source": "国家统计局",
                "description": "制造业采购经理指数"
            })
            
        # 2. CPI 同比
        cpi_df = ak.macro_china_cpi()
        if not cpi_df.empty:
            latest = cpi_df.iloc[-1]
            data.append({
                "dataType": "macro",
                "indicator": "CPI同比",
                "value": float(latest['今值']),
                "unit": "%",
                "releaseDate": str(latest['月份']),
                "source": "国家统计局",
                "description": "居民消费价格指数"
            })
            
        # 3. PPI 同比
        ppi_df = ak.macro_china_ppi()
        if not ppi_df.empty:
            latest = ppi_df.iloc[-1]
            data.append({
                "dataType": "macro",
                "indicator": "PPI同比",
                "value": float(latest['今值']),
                "unit": "%",
                "releaseDate": str(latest['月份']),
                "source": "国家统计局",
                "description": "工业生产者出厂价格指数"
            })
    except Exception as e:
        print(f"Error fetching Fundamental data: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # L: Liquidity (流动性 - 央行、资金面)
    # ---------------------------------------------------------
    try:
        # 1. DR007 (近期均值)
        dr007_df = ak.rate_interbank(market="银行间市场", symbol="质押式回购利率", indicator="DR007")
        if not dr007_df.empty:
            latest = dr007_df.iloc[-1]
            data.append({
                "dataType": "liquidity",
                "indicator": "DR007",
                "value": float(latest['利率']),
                "unit": "%",
                "releaseDate": str(latest['日期']),
                "source": "中国货币网",
                "description": "银行间存款类机构7天质押式回购利率"
            })
            
        # 2. 7天逆回购利率
        # 使用公开市场操作数据
        repo_df = ak.macro_china_open_market_operation()
        if not repo_df.empty:
            # 过滤出7天逆回购
            repo7d = repo_df[repo_df['操作期限'] == '7天'].iloc[0]
            data.append({
                "dataType": "liquidity",
                "indicator": "7天逆回购利率",
                "value": float(repo7d['中标利率']),
                "unit": "%",
                "releaseDate": str(repo7d['日期']),
                "source": "人民银行",
                "description": "公开市场操作中标利率"
            })
    except Exception as e:
        print(f"Error fetching Liquidity data: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # A: Allocation (债券供需 - 利率债、发行)
    # ---------------------------------------------------------
    try:
        # 1. 10Y 国债收益率 (定价锚点)
        yield_df = ak.bond_china_yield(start_date=(now - timedelta(days=5)).strftime("%Y%m%d"))
        if not yield_df.empty:
            # 找到10年期国债
            ten_year = yield_df[yield_df['曲线名称'] == '中债国债收益率曲线']
            if not ten_year.empty:
                latest = ten_year.iloc[-1]
                data.append({
                    "dataType": "bond_market",
                    "indicator": "10Y国债收益率",
                    "value": float(latest['10年']),
                    "unit": "%",
                    "releaseDate": str(latest['日期']),
                    "source": "中债估值",
                    "description": "10年期国债到期收益率"
                })
    except Exception as e:
        print(f"Error fetching Allocation data: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # M: Market Sentiment (市场情绪 - 预期、杠杆)
    # ---------------------------------------------------------
    # 这里通常用 30Y-10Y 利差或国债期货基差表示
    try:
        # 计算 30Y-10Y 利差作为情绪指标
        if not yield_df.empty:
            ten_year = yield_df[yield_df['曲线名称'] == '中债国债收益率曲线'].iloc[-1]
            spread = float(ten_year['30年']) - float(ten_year['10年'])
            data.append({
                "dataType": "sentiment",
                "indicator": "30Y-10Y利差",
                "value": round(spread * 100, 2), # 换算成BP
                "unit": "BP",
                "releaseDate": str(ten_year['日期']),
                "source": "中债估值",
                "description": "期限利差，反映市场对长端利率的预期"
            })
    except Exception as e:
        print(f"Error fetching Sentiment data: {e}", file=sys.stderr)

    # ---------------------------------------------------------
    # E: External Environment (外部环境 - 汇率、美债)
    # ---------------------------------------------------------
    try:
        # 1. USD/CNY 汇率
        fx_df = ak.currency_boc_sinajs(symbol="USDCNY")
        if not fx_df.empty:
            latest = fx_df.iloc[0]
            data.append({
                "dataType": "external",
                "indicator": "USD/CNY汇率",
                "value": float(latest['ask']),
                "unit": "",
                "releaseDate": now.strftime("%Y-%m-%d"),
                "source": "中国银行",
                "description": "美元兑人民币中间价"
            })
    except Exception as e:
        print(f"Error fetching External data: {e}", file=sys.stderr)

    return data

if __name__ == "__main__":
    flame_data = fetch_flame_data()
    print(json.dumps(flame_data, ensure_ascii=False))
