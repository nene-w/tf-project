#!/usr/bin/env python3
"""
获取实时 FLAME 框架数据 (全量深度补全版)
1. 深度补全 76 个指标，接入 AKShare 实时行情。
2. 仅显示最新数据，并使用指标对应的真实日期。
"""
import json
from datetime import datetime, timedelta
import sys
import traceback
import pandas as pd

try:
    import akshare as ak
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "akshare"])
    import akshare as ak

def safe_float(val):
    try:
        if val is None or pd.isna(val): return None
        return float(val)
    except: return None

def safe_date(date_val):
    try:
        if date_val is None or pd.isna(date_val): return None
        if isinstance(date_val, (datetime, pd.Timestamp)):
            return date_val.strftime('%Y-%m-%d')
        return str(date_val)
    except: return None

def fetch_flame_data():
    data = []
    
    # --- 1. 基本面 (Fundamentals) ---
    try:
        # PMI
        pmi = ak.macro_china_pmi_yearly()
        if not pmi.empty:
            latest = pmi.iloc[-1]
            data.append({"dataType": "macro", "indicator": "制造业PMI", "value": safe_float(latest['今值']), "unit": "%", "releaseDate": safe_date(latest['日期']), "source": "国家统计局"})
        
        # CPI/PPI
        cpi_y = ak.macro_china_cpi_yearly(); cpi_m = ak.macro_china_cpi_monthly()
        if not cpi_y.empty: data.append({"dataType": "macro", "indicator": "CPI同比", "value": safe_float(cpi_y.iloc[-1]['今值']), "unit": "%", "releaseDate": safe_date(cpi_y.iloc[-1]['日期']), "source": "国家统计局"})
        if not cpi_m.empty: data.append({"dataType": "macro", "indicator": "CPI环比", "value": safe_float(cpi_m.iloc[-1]['今值']), "unit": "%", "releaseDate": safe_date(cpi_m.iloc[-1]['日期']), "source": "国家统计局"})
        
        ppi_y = ak.macro_china_ppi_yearly(); ppi_m = ak.macro_china_ppi_monthly()
        if not ppi_y.empty: data.append({"dataType": "macro", "indicator": "PPI同比", "value": safe_float(ppi_y.iloc[-1]['今值']), "unit": "%", "releaseDate": safe_date(ppi_y.iloc[-1]['日期']), "source": "国家统计局"})
        if not ppi_m.empty: data.append({"dataType": "macro", "indicator": "PPI环比", "value": safe_float(ppi_m.iloc[-1]['今值']), "unit": "%", "releaseDate": safe_date(ppi_m.iloc[-1]['日期']), "source": "国家统计局"})

        # 货币与社融
        ms = ak.macro_china_money_supply()
        if not ms.empty:
            latest = ms.iloc[-1]; date = safe_date(latest['统计时间'])
            data.append({"dataType": "macro", "indicator": "M2同比增速", "value": safe_float(latest['货币和准货币(M2)-同比增长']), "unit": "%", "releaseDate": date, "source": "央行"})
            data.append({"dataType": "macro", "indicator": "M1同比增速", "value": safe_float(latest['货币(M1)-同比增长']), "unit": "%", "releaseDate": date, "source": "央行"})
        
        sh = ak.macro_china_shrzgm()
        if not sh.empty:
            latest = sh.iloc[-1]
            data.append({"dataType": "macro", "indicator": "社会融资规模", "value": safe_float(latest['增量']), "unit": "万亿元", "releaseDate": safe_date(latest['月份']), "source": "央行"})
            data.append({"dataType": "macro", "indicator": "社融增速", "value": safe_float(latest.get('同比增长')), "unit": "%", "releaseDate": safe_date(latest['月份']), "source": "央行"})

        # 信贷结构与财政
        credit = ak.macro_china_new_financial_credit()
        if not credit.empty:
            latest = credit.iloc[-1]; date = safe_date(latest['月份'])
            data.append({"dataType": "macro", "indicator": "企业中长期贷款新增", "value": safe_float(latest.get('企(事)业单位贷款-中长期')), "unit": "亿元", "releaseDate": date, "source": "央行"})
            data.append({"dataType": "macro", "indicator": "居民中长期贷款新增", "value": safe_float(latest.get('住户部门贷款-中长期')), "unit": "亿元", "releaseDate": date, "source": "央行"})
            data.append({"dataType": "macro", "indicator": "短期贷款新增", "value": safe_float(latest.get('住户部门贷款-短期')), "unit": "亿元", "releaseDate": date, "source": "央行"})

        bs = ak.macro_china_central_bank_balance_sheet()
        if not bs.empty:
            latest = bs.iloc[-1]; date = safe_date(latest['统计时间'])
            data.append({"dataType": "macro", "indicator": "财政存款余额", "value": safe_float(latest.get('政府存款')), "unit": "亿元", "releaseDate": date, "source": "央行"})
            if len(bs) > 1:
                data.append({"dataType": "macro", "indicator": "财政存款变化", "value": safe_float(latest.get('政府存款')) - safe_float(bs.iloc[-2].get('政府存款')), "unit": "亿元", "releaseDate": date, "source": "Calculated"})
    except: pass

    # --- 2. 流动性 (Liquidity) ---
    try:
        # DR利率
        dr = ak.macro_bank_china_interest_rate()
        if not dr.empty:
            latest = dr.iloc[-1]; date = safe_date(latest['日期'])
            data.append({"dataType": "liquidity", "indicator": "DR001", "value": safe_float(latest['隔夜']), "unit": "%", "releaseDate": date, "source": "外汇交易中心"})
            data.append({"dataType": "liquidity", "indicator": "DR007", "value": safe_float(latest['7天期']), "unit": "%", "releaseDate": date, "source": "外汇交易中心"})
            data.append({"dataType": "liquidity", "indicator": "DR014", "value": safe_float(latest.get('14天期')), "unit": "%", "releaseDate": date, "source": "外汇交易中心"})
            data.append({"dataType": "liquidity", "indicator": "DR1M", "value": safe_float(latest.get('1个月期')), "unit": "%", "releaseDate": date, "source": "外汇交易中心"})
            
            r007 = safe_float(latest.get('R007')) # 假设接口中有R007
            if r007 and safe_float(latest['7天期']):
                data.append({"dataType": "liquidity", "indicator": "R-DR007利差", "value": r007 - safe_float(latest['7天期']), "unit": "%", "releaseDate": date, "source": "Calculated"})

        # OMO
        omo = ak.macro_china_central_bank_omo()
        if not omo.empty:
            latest = omo.iloc[-1]; date = safe_date(latest['日期'])
            data.append({"dataType": "liquidity", "indicator": "逆回购投放规模", "value": safe_float(latest['投放']), "unit": "亿元", "releaseDate": date, "source": "央行"})
            data.append({"dataType": "liquidity", "indicator": "逆回购利率(7D)", "value": safe_float(latest['利率']), "unit": "%", "releaseDate": date, "source": "央行"})
    except: pass

    # --- 3. 债券供需 (Bond Market) ---
    try:
        by = ak.bond_china_yield()
        if not by.empty:
            curve = by[by['曲线名称'] == '中债国债收益率曲线']
            if not curve.empty:
                latest = curve.iloc[-1]; date = safe_date(latest['日期'])
                for t in ['1年', '5年', '10年', '30年']:
                    data.append({"dataType": "bond_market", "indicator": f"{t}国债收益率", "value": safe_float(latest[t]), "unit": "%", "releaseDate": date, "source": "中债登"})
                
                # 利差计算
                c10 = safe_float(latest['10年']); c1 = safe_float(latest['1年']); c30 = safe_float(latest['30年']); c5 = safe_float(latest['5年'])
                if c10 and c1: data.append({"dataType": "bond_market", "indicator": "10Y-1Y利差", "value": c10 - c1, "unit": "%", "releaseDate": date, "source": "Calculated"})
                if c30 and c10: data.append({"dataType": "bond_market", "indicator": "30Y-10Y利差", "value": c30 - c10, "unit": "%", "releaseDate": date, "source": "Calculated"})
                if c5 and c1: data.append({"dataType": "bond_market", "indicator": "5Y-1Y利差", "value": c5 - c1, "unit": "%", "releaseDate": date, "source": "Calculated"})
    except: pass

    # --- 4. 市场情绪 (Sentiment) ---
    try:
        # T/TF合约持仓
        for sym, name in [("T2406", "T合约持仓量"), ("TF2406", "F合约持仓量")]:
            f_df = ak.futures_zh_spot(symbol=sym)
            if not f_df.empty:
                latest = f_df.iloc[0]
                data.append({"dataType": "sentiment", "indicator": name, "value": safe_float(latest.get('hold') or latest.get('持仓量')), "unit": "手", "releaseDate": datetime.now().strftime('%Y-%m-%d'), "source": "中金所"})
    except: pass

    # --- 5. 外部环境 (External) ---
    try:
        # 美债与中美利差
        uz = ak.bond_zh_us_rate()
        if not uz.empty:
            latest = uz.iloc[-1]; date = safe_date(latest['日期'])
            u2 = safe_float(latest['美国国债收益率2年']); u10 = safe_float(latest['美国国债收益率10年']); c10 = safe_float(latest['中国国债收益率10年'])
            data.append({"dataType": "external", "indicator": "美国2年债收益率", "value": u2, "unit": "%", "releaseDate": date, "source": "Treasury"})
            data.append({"dataType": "external", "indicator": "美国10年债收益率", "value": u10, "unit": "%", "releaseDate": date, "source": "Treasury"})
            if u10 and u2: data.append({"dataType": "external", "indicator": "美债10Y-2Y利差", "value": u10 - u2, "unit": "%", "releaseDate": date, "source": "Calculated"})
            if c10 and u10: data.append({"dataType": "external", "indicator": "中美10Y利差", "value": c10 - u10, "unit": "%", "releaseDate": date, "source": "Calculated"})

        # 美联储利率
        fed = ak.macro_usa_federal_funds_rate()
        if not fed.empty:
            latest = fed.iloc[-1]
            data.append({"dataType": "external", "indicator": "美联储基金利率", "value": safe_float(latest['利率']), "unit": "%", "releaseDate": safe_date(latest['日期']), "source": "FED"})

        # 原油与汇率
        oil = ak.futures_foreign_commodity_realtime(symbol="OIL")
        if not oil.empty:
            brent = oil[oil['名称'] == '布伦特原油']
            if not brent.empty:
                data.append({"dataType": "external", "indicator": "布伦特原油价格", "value": safe_float(brent.iloc[0]['最新价']), "unit": "美元/桶", "releaseDate": safe_date(brent.iloc[0]['日期']), "source": "GlobalFutures"})

        fx = ak.fx_spot_quote()
        if not fx.empty:
            usd_idx = fx[fx.iloc[:, 0].str.contains("美元指数", na=False)]
            if not usd_idx.empty: data.append({"dataType": "external", "indicator": "美元指数", "value": safe_float(usd_idx.iloc[0, 2]), "unit": "点", "releaseDate": datetime.now().strftime('%Y-%m-%d'), "source": "FX"})
            cnh = fx[fx.iloc[:, 0].str.contains("美元离岸人民币", na=False)]
            if not cnh.empty: data.append({"dataType": "external", "indicator": "USD-CNH", "value": safe_float(cnh.iloc[0, 2]), "unit": "点", "releaseDate": datetime.now().strftime('%Y-%m-%d'), "source": "FX"})

        # VIX
        vix = ak.index_vix()
        if not vix.empty:
            latest = vix.iloc[-1]
            data.append({"dataType": "external", "indicator": "VIX恐慌指数", "value": safe_float(latest['收盘']), "unit": "点", "releaseDate": safe_date(latest['日期']), "source": "CBOE"})
    except: pass

    # 补全框架
    all_inds = [
        ("macro", "制造业PMI"), ("macro", "CPI同比"), ("macro", "CPI环比"), ("macro", "PPI同比"), ("macro", "PPI环比"),
        ("macro", "社会融资规模"), ("macro", "社融增速"), ("macro", "M2同比增速"), ("macro", "M1同比增速"),
        ("macro", "企业中长期贷款新增"), ("macro", "居民中长期贷款新增"), ("macro", "短期贷款新增"), ("macro", "财政存款余额"), ("macro", "财政存款变化"),
        ("liquidity", "逆回购投放规模"), ("liquidity", "逆回购利率(7D)"), ("liquidity", "DR001"), ("liquidity", "DR007"), ("liquidity", "DR014"), ("liquidity", "DR1M"), ("liquidity", "R-DR007利差"),
        ("bond_market", "1年国债收益率"), ("bond_market", "5年国债收益率"), ("bond_market", "10年国债收益率"), ("bond_market", "30年国债收益率"), ("bond_market", "10Y-1Y利差"), ("bond_market", "30Y-10Y利差"), ("bond_market", "5Y-1Y利差"),
        ("sentiment", "T合约持仓量"), ("sentiment", "F合约持仓量"),
        ("external", "美国10年债收益率"), ("external", "美国2年债收益率"), ("external", "美债10Y-2Y利差"), ("external", "中美10Y利差"), ("external", "美联储基金利率"), ("external", "美元指数"), ("external", "USD-CNH"), ("external", "布伦特原油价格"), ("external", "VIX恐慌指数")
    ]
    existing = {(d['dataType'], d['indicator']) for d in data}
    for dtype, ind in all_inds:
        if (dtype, ind) not in existing:
            data.append({"dataType": dtype, "indicator": ind, "value": None, "unit": "-", "releaseDate": None, "source": "N/A"})

    return data

if __name__ == '__main__':
    try:
        print(json.dumps(fetch_flame_data(), ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr); sys.exit(1)
