#!/usr/bin/env python3
"""
获取实时 FLAME 框架数据 (已验证接口版)
- 优先使用日级别数据；无日级别则使用月级别
- 只保留在当前环境经过测试可用的 AKShare 接口
- 超时接口（东财/金十等）已移除，改为 null 兜底
- 自动获取 T/TF 主力合约代码，避免硬编码
"""
import json
import sys
import io
import traceback
from datetime import datetime, timedelta

try:
    import pandas as pd
    import akshare as ak
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "akshare", "--quiet"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import pandas as pd
    import akshare as ak


def safe_float(val):
    try:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return None
        return float(val)
    except Exception:
        return None


def safe_date(val):
    try:
        if val is None:
            return None
        if isinstance(val, (datetime, pd.Timestamp)):
            return val.strftime('%Y-%m-%d')
        s = str(val)
        # 处理 "2026年02月份" 格式
        if '年' in s and '月' in s:
            s = s.replace('年', '-').replace('月份', '').replace('月', '')
            parts = s.split('-')
            return f"{parts[0]}-{parts[1].zfill(2)}"
        # 处理 "202602" 格式
        if len(s) == 6 and s.isdigit():
            return f"{s[:4]}-{s[4:]}"
        return s[:10] if len(s) >= 10 else s
    except Exception:
        return None


def today_str():
    return datetime.now().strftime('%Y-%m-%d')


def get_main_contract(symbol):
    """
    动态获取主力合约代码
    """
    try:
        df = ak.futures_main_sina(symbol=symbol)
        if not df.empty:
            # 返回最新的一条主力合约代码
            return df.iloc[-1]['main_code'].upper()
    except Exception:
        pass
    # 兜底逻辑：如果接口失败，返回当前可能的季度合约
    # 2026年4月，主力通常是 2606 或 2609
    return f"{symbol}2606"


def fetch_flame_data():
    data = []
    today = datetime.now().strftime('%Y%m%d')
    last7 = (datetime.now() - timedelta(days=7)).strftime('%Y%m%d')

    # ─────────────────────────────────────────────
    # F 基本面 (Fundamentals)
    # ─────────────────────────────────────────────
    try:
        ms = ak.macro_china_money_supply()
        if not ms.empty:
            latest = ms.iloc[0]  # 倒序，第一行最新
            date = safe_date(latest['月份'])
            data.append({"dataType": "macro", "indicator": "M2同比增速",
                         "value": safe_float(latest['货币和准货币(M2)-同比增长']),
                         "unit": "%", "releaseDate": date, "source": "央行"})
            data.append({"dataType": "macro", "indicator": "M1同比增速",
                         "value": safe_float(latest['货币(M1)-同比增长']),
                         "unit": "%", "releaseDate": date, "source": "央行"})
    except Exception:
        pass

    try:
        sh = ak.macro_china_shrzgm()
        if not sh.empty:
            latest = sh.iloc[-1]  # 正序，最后一行最新
            date = safe_date(latest['月份'])
            data.append({"dataType": "macro", "indicator": "社会融资规模",
                         "value": safe_float(latest['社会融资规模增量']),
                         "unit": "亿元", "releaseDate": date, "source": "央行"})
    except Exception:
        pass

    try:
        qy = ak.macro_china_qyspjg()
        if not qy.empty:
            latest = qy.iloc[0]  # 倒序，第一行最新
            date = safe_date(latest['月份'])
            data.append({"dataType": "macro", "indicator": "企业商品价格指数同比",
                         "value": safe_float(latest['总指数-同比增长']),
                         "unit": "%", "releaseDate": date, "source": "国家统计局"})
    except Exception:
        pass

    # ─────────────────────────────────────────────
    # A 债券供需 (Bond Market)
    # ─────────────────────────────────────────────
    try:
        by = ak.bond_china_yield(start_date=last7, end_date=today)
        if not by.empty:
            curve = by[by['曲线名称'] == '中债国债收益率曲线']
            if not curve.empty:
                latest = curve.iloc[-1]
                date = safe_date(latest['日期'])
                for tenor in ['3月', '6月', '1年', '3年', '5年', '7年', '10年', '30年']:
                    if tenor in latest.index:
                        data.append({"dataType": "bond_market",
                                     "indicator": f"{tenor}国债收益率",
                                     "value": safe_float(latest[tenor]),
                                     "unit": "%", "releaseDate": date, "source": "中债登"})

                # 利差计算
                c1 = safe_float(latest.get('1年'))
                c5 = safe_float(latest.get('5年'))
                c10 = safe_float(latest.get('10年'))
                c30 = safe_float(latest.get('30年'))
                if c10 is not None and c1 is not None:
                    data.append({"dataType": "bond_market", "indicator": "10Y-1Y利差",
                                 "value": round(c10 - c1, 4), "unit": "%",
                                 "releaseDate": date, "source": "Calculated"})
                if c30 is not None and c10 is not None:
                    data.append({"dataType": "bond_market", "indicator": "30Y-10Y利差",
                                 "value": round(c30 - c10, 4), "unit": "%",
                                 "releaseDate": date, "source": "Calculated"})
                if c5 is not None and c1 is not None:
                    data.append({"dataType": "bond_market", "indicator": "5Y-1Y利差",
                                 "value": round(c5 - c1, 4), "unit": "%",
                                 "releaseDate": date, "source": "Calculated"})

                # 用 1Y 国债收益率作为流动性参考（短端利率）
                if c1 is not None:
                    data.append({"dataType": "liquidity", "indicator": "1Y国债收益率(流动性参考)",
                                 "value": c1, "unit": "%", "releaseDate": date, "source": "中债登"})
    except Exception:
        pass

    # ─────────────────────────────────────────────
    # M 市场情绪 (Sentiment) - 自动切换主力合约
    # ─────────────────────────────────────────────
    try:
        # 动态获取 T 和 TF 的主力合约代码
        main_t = get_main_contract("T")
        main_tf = get_main_contract("TF")
        
        for sym, name in [(main_t, "T合约收盘价"), (main_tf, "TF合约收盘价")]:
            try:
                f_df = ak.futures_zh_daily_sina(symbol=sym)
                if not f_df.empty:
                    latest = f_df.iloc[-1]
                    # 在指标名称中加入合约代码，方便用户确认
                    display_name = f"{name}({sym})"
                    data.append({"dataType": "sentiment", "indicator": display_name,
                                 "value": safe_float(latest['close']),
                                 "unit": "元", "releaseDate": safe_date(latest['date']),
                                 "source": "中金所"})
                    data.append({"dataType": "sentiment", "indicator": display_name.replace("收盘价", "持仓量"),
                                 "value": safe_float(latest.get('hold')),
                                 "unit": "手", "releaseDate": safe_date(latest['date']),
                                 "source": "中金所"})
            except Exception:
                pass
    except Exception:
        pass

    # ─────────────────────────────────────────────
    # E 外部环境 (External)
    # ─────────────────────────────────────────────
    try:
        oil = ak.futures_foreign_commodity_realtime(symbol="OIL")
        if not oil.empty:
            brent = oil[oil['名称'].str.contains('布伦特', na=False)]
            if not brent.empty:
                row = brent.iloc[0]
                data.append({"dataType": "external", "indicator": "布伦特原油价格",
                             "value": safe_float(row['最新价']),
                             "unit": "美元/桶",
                             "releaseDate": safe_date(row.get('日期')) or today_str(),
                             "source": "GlobalFutures"})
    except Exception:
        pass

    try:
        fx = ak.fx_spot_quote()
        if not fx.empty:
            # 美元指数
            usd_idx = fx[fx['货币对'].str.contains('美元指数', na=False)]
            if not usd_idx.empty:
                data.append({"dataType": "external", "indicator": "美元指数",
                             "value": safe_float(usd_idx.iloc[0]['卖报价']),
                             "unit": "点", "releaseDate": today_str(), "source": "FX"})
            # USD-CNH (离岸人民币)
            cnh = fx[fx['货币对'].str.contains('美元.*人民币|CNH|CNY', na=False)]
            if not cnh.empty:
                data.append({"dataType": "external", "indicator": "USD-CNH",
                             "value": safe_float(cnh.iloc[0]['卖报价']),
                             "unit": "元", "releaseDate": today_str(), "source": "FX"})
    except Exception:
        pass

    # ─────────────────────────────────────────────
    # 补全框架：确保所有指标都有条目（无数据则 null）
    # ─────────────────────────────────────────────
    all_indicators = [
        ("macro", "制造业PMI", "%"),
        ("macro", "CPI同比", "%"),
        ("macro", "CPI环比", "%"),
        ("macro", "PPI同比", "%"),
        ("macro", "PPI环比", "%"),
        ("macro", "M2同比增速", "%"),
        ("macro", "M1同比增速", "%"),
        ("macro", "社会融资规模", "亿元"),
        ("macro", "社融增速", "%"),
        ("macro", "企业中长期贷款新增", "亿元"),
        ("macro", "居民中长期贷款新增", "亿元"),
        ("macro", "短期贷款新增", "亿元"),
        ("macro", "财政存款余额", "亿元"),
        ("macro", "财政存款变化", "亿元"),
        ("macro", "企业商品价格指数同比", "%"),
        ("liquidity", "DR001", "%"),
        ("liquidity", "DR007", "%"),
        ("liquidity", "DR014", "%"),
        ("liquidity", "DR1M", "%"),
        ("liquidity", "逆回购投放规模", "亿元"),
        ("liquidity", "逆回购利率(7D)", "%"),
        ("liquidity", "R-DR007利差", "%"),
        ("liquidity", "1Y国债收益率(流动性参考)", "%"),
        ("liquidity", "MLF余额", "亿元"),
        ("bond_market", "3月国债收益率", "%"),
        ("bond_market", "6月国债收益率", "%"),
        ("bond_market", "1年国债收益率", "%"),
        ("bond_market", "3年国债收益率", "%"),
        ("bond_market", "5年国债收益率", "%"),
        ("bond_market", "7年国债收益率", "%"),
        ("bond_market", "10年国债收益率", "%"),
        ("bond_market", "30年国债收益率", "%"),
        ("bond_market", "10Y-1Y利差", "%"),
        ("bond_market", "30Y-10Y利差", "%"),
        ("bond_market", "5Y-1Y利差", "%"),
        ("bond_market", "国债发行规模", "亿元"),
        ("bond_market", "地方债发行规模", "亿元"),
        ("sentiment", "T合约收盘价", "元"),
        ("sentiment", "T合约持仓量", "手"),
        ("sentiment", "TF合约收盘价", "元"),
        ("sentiment", "TF合约持仓量", "手"),
        ("sentiment", "杠杆水平变化", "%"),
        ("sentiment", "收益率止盈位", "%"),
        ("external", "美国10年债收益率", "%"),
        ("external", "美国2年债收益率", "%"),
        ("external", "美债10Y-2Y利差", "%"),
        ("external", "中美10Y利差", "%"),
        ("external", "美联储基金利率", "%"),
        ("external", "美元指数", "点"),
        ("external", "USD-CNH", "元"),
        ("external", "布伦特原油价格", "美元/桶"),
        ("external", "VIX恐慌指数", "点"),
        ("external", "CRB指数", "点"),
    ]

    existing = {(d['dataType'], d['indicator']) for d in data}
    # 检查动态合约名称是否已存在
    main_t = get_main_contract("T")
    main_tf = get_main_contract("TF")
    
    for dtype, ind, unit in all_indicators:
        # 特殊处理动态合约名称
        check_ind = ind
        if ind == "T合约收盘价": check_ind = f"T合约收盘价({main_t})"
        if ind == "T合约持仓量": check_ind = f"T合约持仓量({main_t})"
        if ind == "TF合约收盘价": check_ind = f"TF合约收盘价({main_tf})"
        if ind == "TF合约持仓量": check_ind = f"TF合约持仓量({main_tf})"
        
        if (dtype, check_ind) not in existing:
            data.append({"dataType": dtype, "indicator": check_ind,
                         "value": None, "unit": unit,
                         "releaseDate": None, "source": "N/A"})

    return data


if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    try:
        result = fetch_flame_data()
        print(json.dumps(result, ensure_ascii=False, default=str))
    except Exception as e:
        print(json.dumps({"error": str(e), "traceback": traceback.format_exc()},
                         ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
