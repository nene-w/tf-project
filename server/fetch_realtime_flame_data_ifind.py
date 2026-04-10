import iFinDPy as iFinD
import json
import sys
from datetime import datetime

# iFinD 账号和密码
IFIND_USERNAME = 'yinnuo082'
IFIND_PASSWORD = 'tkt3479X'

def login_ifind():
    """登录 iFinD 并返回登录结果。"""
    try:
        ret = iFinD.THS_iFinDLogin(IFIND_USERNAME, IFIND_PASSWORD)
        if ret == 0:
            return True
        else:
            print(f"iFinD 登录失败，错误码: {ret}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"iFinD 登录异常: {e}", file=sys.stderr)
        return False

def get_ifind_data(ths_code, ths_field, options=""):
    """从 iFinD 获取指定代码和字段的最新数据。"""
    try:
        data = iFinD.THS_RQ(ths_code, ths_field, options, "")
        if data.error == 0 and data.data:
            # iFinD 返回的数据结构可能比较复杂，需要根据实际情况解析
            # 这里假设 data.data[ths_field] 是一个列表，取第一个值作为最新数据
            value = data.data[ths_field][0] if data.data[ths_field] else None
            # iFinD 的日期字段可能因接口而异，需要具体分析
            # 暂时使用当前日期作为占位符，后续需要根据实际接口返回的日期字段进行提取
            release_date = datetime.now().strftime('%Y-%m-%d') # Placeholder
            return {"value": value, "releaseDate": release_date}
        else:
            print(f"获取 iFinD 数据失败: {ths_code} - {ths_field}, 错误: {data.error}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"获取 iFinD 数据异常: {ths_code} - {ths_field}, 异常: {e}", file=sys.stderr)
        return None

def get_main_futures_contract(symbol):
    """从 iFinD 获取指定期货品种的主力合约代码。"""
    try:
        # iFinD 获取主力合约的接口可能与 AKShare 不同，需要查找具体接口
        # 假设 THS_RQ 可以通过特定字段获取主力合约
        # 例如：symbol = 'T', field = 'ths_main_contract_code'
        # 这里先用一个占位符，需要根据 iFinD 文档确认
        # 暂时返回硬编码值，待查证 iFinD 接口
        if symbol == 'TL':
            return 'TL.CFE' # 示例
        elif symbol == 'T':
            return 'T.CFE' # 示例
        elif symbol == 'TF':
            return 'TF.CFE' # 示例
        else:
            return None
    except Exception as e:
        print(f"获取 {symbol} 主力合约异常: {e}", file=sys.stderr)
        return None

def get_flame_indicators_data():
    """获取 FLAME 框架所有指标的实时数据。"""
    if not login_ifind():
        return []

    # FLAME 框架指标配置，需要手动映射 iFinD 代码和字段
    # 结构：{"indicator": "指标名称", "ifind_code": "iFinD证券代码", "ifind_field": "iFinD字段", "unit": "单位"}
    # 这里的 ifind_code 和 ifind_field 只是示例，需要根据实际情况查找和补充
    flame_indicators_config = [
        # F 基本面 (Fundamentals)
        {"indicator": "制造业PMI", "ifind_code": "M002043802", "ifind_field": "ths_pmi_manuf", "unit": "%"}, # 中国制造业PMI
        {"indicator": "CPI同比", "ifind_code": "M000000001", "ifind_field": "ths_cpi_yoy", "unit": "%"}, # 中国CPI同比
        {"indicator": "CPI环比", "ifind_code": "M000000001", "ifind_field": "ths_cpi_mom", "unit": "%"}, # 中国CPI环比
        {"indicator": "PPI同比", "ifind_code": "M002826865", "ifind_field": "ths_ppi_yoy", "unit": "%"}, # 中国PPI同比
        {"indicator": "PPI环比", "ifind_code": "M000000002", "ifind_field": "ths_ppi_mom", "unit": "%"}, # 中国PPI环比
        {"indicator": "M2同比增速", "ifind_code": "M000000003", "ifind_field": "ths_macro_m2_yoy", "unit": "%"}, # 中国M2同比
        {"indicator": "M1同比增速", "ifind_code": "M000000004", "ifind_field": "ths_macro_m1_yoy", "unit": "%"}, # 中国M1同比
        {"indicator": "社会融资规模", "ifind_code": "M000000005", "ifind_field": "ths_macro_shrzgm_total", "unit": "亿元"}, # 社会融资规模增量
        {"indicator": "社融增速", "ifind_code": "M000000005", "ifind_field": "ths_macro_shrzgm_yoy", "unit": "%"}, # 社会融资规模同比
        {"indicator": "企业中长期贷款新增", "ifind_code": "M000000006", "ifind_field": "ths_macro_loan_corp_lt_new", "unit": "亿元"}, # 待确认
        {"indicator": "居民中长期贷款新增", "ifind_code": "M000000007", "ifind_field": "ths_macro_loan_resi_lt_new", "unit": "亿元"}, # 待确认
        {"indicator": "短期贷款新增", "ifind_code": "M000000008", "ifind_field": "ths_macro_loan_short_new", "unit": "亿元"}, # 待确认
        {"indicator": "财政存款余额", "ifind_code": "M000000009", "ifind_field": "ths_macro_fiscal_deposit_balance", "unit": "亿元"}, # 待确认
        {"indicator": "财政存款变化", "ifind_code": "M000000009", "ifind_field": "ths_macro_fiscal_deposit_change", "unit": "亿元"}, # 待确认
        {"indicator": "企业商品价格指数同比", "ifind_code": "M000000010", "ifind_field": "ths_macro_corp_goods_price_yoy", "unit": "%"}, # 待确认

        # A 债券供需 (Bond Market)
        {"indicator": "3月国债收益率", "ifind_code": "CDB3M.IB", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "6月国债收益率", "ifind_code": "CDB6M.IB", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "1年国债收益率", "ifind_code": "CDB1Y.IB", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "3年国债收益率", "ifind_code": "CDB3Y.IB", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "5年国债收益率", "ifind_code": "CDB5Y.IB", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "7年国债收益率", "ifind_code": "CDB7Y.IB", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "10年国债收益率", "ifind_code": "CDB10Y.IB", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "30年国债收益率", "ifind_code": "CDB30Y.IB", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "10Y-1Y利差", "ifind_code": "CDB10Y.IB", "ifind_field": "ths_bond_yield_spread_10y_1y", "unit": "%"}, # 示例，可能需要计算
        {"indicator": "30Y-10Y利差", "ifind_code": "CDB30Y.IB", "ifind_field": "ths_bond_yield_spread_30y_10y", "unit": "%"}, # 示例，可能需要计算
        {"indicator": "5Y-1Y利差", "ifind_code": "CDB5Y.IB", "ifind_field": "ths_bond_yield_spread_5y_1y", "unit": "%"}, # 示例，可能需要计算
        {"indicator": "国债发行规模", "ifind_code": "M000000011", "ifind_field": "ths_bond_issue_gov", "unit": "亿元"}, # 示例
        {"indicator": "地方债发行规模", "ifind_code": "M000000012", "ifind_field": "ths_bond_issue_local", "unit": "亿元"}, # 示例

        # L 流动性 (Liquidity)
        {"indicator": "DR001", "ifind_code": "DR001.IB", "ifind_field": "ths_repo_rate", "unit": "%"}, # 示例
        {"indicator": "DR007", "ifind_code": "DR007.IB", "ifind_field": "ths_repo_rate", "unit": "%"}, # 示例
        {"indicator": "DR014", "ifind_code": "DR014.IB", "ifind_field": "ths_repo_rate", "unit": "%"}, # 示例
        {"indicator": "DR1M", "ifind_code": "DR1M.IB", "ifind_field": "ths_repo_rate", "unit": "%"}, # 示例
        {"indicator": "逆回购投放规模", "ifind_code": "M000000013", "ifind_field": "ths_pbc_reverse_repo_inject", "unit": "亿元"}, # 示例
        {"indicator": "逆回购利率(7D)", "ifind_code": "M000000014", "ifind_field": "ths_pbc_reverse_repo_rate_7d", "unit": "%"}, # 示例
        {"indicator": "R-DR007利差", "ifind_code": "M000000015", "ifind_field": "ths_repo_dr007_spread", "unit": "%"}, # 示例，可能需要计算
        {"indicator": "1Y国债收益率(流动性参考)", "ifind_code": "CDB1Y.IB", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "MLF余额", "ifind_code": "M000000016", "ifind_field": "ths_pbc_mlf_balance", "unit": "亿元"}, # 示例

        # M 市场情绪 (Sentiment)
        {"indicator": "TL合约收盘价", "ifind_code": "TL.CFE", "ifind_field": "ths_future_close", "unit": "元"}, # 示例
        {"indicator": "TL合约持仓量", "ifind_code": "TL.CFE", "ifind_field": "ths_future_open_interest", "unit": "手"}, # 示例
        {"indicator": "TL合约持仓变动", "ifind_code": "TL.CFE", "ifind_field": "ths_future_open_interest_change", "unit": "手"}, # 示例，可能需要计算
        {"indicator": "T合约收盘价", "ifind_code": "T.CFE", "ifind_field": "ths_future_close", "unit": "元"}, # 示例
        {"indicator": "T合约持仓量", "ifind_code": "T.CFE", "ifind_field": "ths_future_open_interest", "unit": "手"}, # 示例
        {"indicator": "T合约持仓变动", "ifind_code": "T.CFE", "ifind_field": "ths_future_open_interest_change", "unit": "手"}, # 示例，可能需要计算
        {"indicator": "TF合约收盘价", "ifind_code": "TF.CFE", "ifind_field": "ths_future_close", "unit": "元"}, # 示例
        {"indicator": "TF合约持仓量", "ifind_code": "TF.CFE", "ifind_field": "ths_future_open_interest", "unit": "手"}, # 示例
        {"indicator": "TF合约持仓变动", "ifind_code": "TF.CFE", "ifind_field": "ths_future_open_interest_change", "unit": "手"}, # 示例，可能需要计算
        {"indicator": "杠杆水平变化", "ifind_code": "M000000017", "ifind_field": "ths_margin_level_change", "unit": "%"}, # 示例
        {"indicator": "收益率止盈位", "ifind_code": "M000000018", "ifind_field": "ths_yield_take_profit", "unit": "%"}, # 示例

        # E 外部环境 (External)
        {"indicator": "美国10年债收益率", "ifind_code": "US10YT.WI", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "美国2年债收益率", "ifind_code": "US2YT.WI", "ifind_field": "ths_bond_yield", "unit": "%"}, # 示例
        {"indicator": "美债10Y-2Y利差", "ifind_code": "US10YT.WI", "ifind_field": "ths_bond_yield_spread_10y_2y", "unit": "%"}, # 示例，可能需要计算
        {"indicator": "中美10Y利差", "ifind_code": "CDB10Y.IB", "ifind_field": "ths_bond_yield_spread_cn_us_10y", "unit": "%"}, # 示例，可能需要计算
        {"indicator": "美联储基金利率", "ifind_code": "FEDFUNDS.FRED", "ifind_field": "ths_fed_funds_rate", "unit": "%"}, # 示例
        {"indicator": "美元指数", "ifind_code": "DXY.FX", "ifind_field": "ths_fx_index", "unit": "点"}, # 示例
        {"indicator": "USD-CNH", "ifind_code": "USDCNH.FX", "ifind_field": "ths_fx_spot", "unit": "元"}, # 示例
        {"indicator": "布伦特原油价格", "ifind_code": "ICE.BRENT", "ifind_field": "ths_commodity_price", "unit": "美元/桶"}, # 示例
        {"indicator": "VIX恐慌指数", "ifind_code": "VIX.GI", "ifind_field": "ths_vix_index", "unit": "点"}, # 示例
        {"indicator": "CRB指数", "ifind_code": "CRB.GI", "ifind_field": "ths_crb_index", "unit": "点"}, # 示例
    ]

    results = []
    for config in flame_indicators_config:
        # 处理主力合约
        if "合约" in config["indicator"] and "持仓变动" not in config["indicator"]:
            symbol_prefix = config["indicator"].split("合约")[0]
            main_contract_code = get_main_futures_contract(symbol_prefix)
            if main_contract_code:
                config["ifind_code"] = main_contract_code

        data = get_ifind_data(config["ifind_code"], config["ifind_field"])
        if data:
            results.append({
                "indicator": config["indicator"],
                "value": data["value"],
                "unit": config["unit"],
                "releaseDate": data["releaseDate"],
                "source": "iFinD"
            })
        else:
            results.append({
                "indicator": config["indicator"],
                "value": None,
                "unit": config["unit"],
                "releaseDate": datetime.now().strftime('%Y-%m-%d'), # 无法获取数据时，日期可设为当前日期或None
                "source": "iFinD"
            })
    return results

if __name__ == '__main__':
    data = get_flame_indicators_data()
    print(json.dumps(data, ensure_ascii=False, indent=4))
