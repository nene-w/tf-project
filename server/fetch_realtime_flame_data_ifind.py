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
        # F 基本面 (Fundamentals) - 已根据用户提供的信息更新
        {"indicator": "制造业PMI", "ifind_code": "M002043802", "ifind_field": "ths_pmi_manuf", "unit": "%"},
        {"indicator": "PPI:当月同比", "ifind_code": "M002826865", "ifind_field": "ths_ppi_yoy", "unit": "%"},
        {"indicator": "PPI:环比", "ifind_code": "M002842661", "ifind_field": "ths_ppi_mom", "unit": "%"},
        {"indicator": "CPI:当月同比", "ifind_code": "M002826730", "ifind_field": "ths_cpi_yoy", "unit": "%"},
        {"indicator": "CPI:环比", "ifind_code": "M002826785", "ifind_field": "ths_cpi_mom", "unit": "%"},
        {"indicator": "M1(货币):同比", "ifind_code": "M001625224", "ifind_field": "ths_macro_m1_yoy", "unit": "%"},
        {"indicator": "M2(货币和准货币):同比", "ifind_code": "M001625222", "ifind_field": "ths_macro_m2_yoy", "unit": "%"},
        {"indicator": "社会融资规模增量:当月值", "ifind_code": "M004891015", "ifind_field": "ths_macro_shrzgm_total", "unit": "亿元"},
        {"indicator": "社会融资规模增量:当月同比", "ifind_code": "M037513681", "ifind_field": "ths_macro_shrzgm_yoy", "unit": "%"},

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

        # L 流动性 (Liquidity) - 已根据用户提供的信息更新
        {"indicator": "DR001", "ifind_code": "L001618739", "ifind_field": "ths_repo_rate", "unit": "%"},
        {"indicator": "DR007", "ifind_code": "L001619493", "ifind_field": "ths_repo_rate", "unit": "%"},
        {"indicator": "DR014", "ifind_code": "L001618740", "ifind_field": "ths_repo_rate", "unit": "%"},
        {"indicator": "DR1M", "ifind_code": "L001619525", "ifind_field": "ths_repo_rate", "unit": "%"},
        {"indicator": "货币投放量:逆回购", "ifind_code": "M003135208", "ifind_field": "ths_pbc_reverse_repo_inject", "unit": "亿元"},
        {"indicator": "逆回购:7日:回购利率", "ifind_code": "L015211422", "ifind_field": "ths_pbc_reverse_repo_rate_7d", "unit": "%"},
        {"indicator": "中期借贷便利(MLF):余额", "ifind_code": "M004026834", "ifind_field": "ths_pbc_mlf_balance", "unit": "亿元"},
        {"indicator": "中期借贷便利(MLF):操作金额:合计", "ifind_code": "M004202865", "ifind_field": "ths_pbc_mlf_inject", "unit": "亿元"},

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

        # E 外部环境 (External) - 已根据用户提供的信息更新
        {"indicator": "美国:国债收益率:10年", "ifind_code": "G002600774", "ifind_field": "ths_bond_yield", "unit": "%"},
        {"indicator": "美国:国债收益率:2年", "ifind_code": "G002600770", "ifind_field": "ths_bond_yield", "unit": "%"},
        {"indicator": "美国:联邦基金利率", "ifind_code": "G002600763", "ifind_field": "ths_fed_funds_rate", "unit": "%"},
        {"indicator": "美国:美元指数", "ifind_code": "G002600885", "ifind_field": "ths_fx_index", "unit": "点"},
        {"indicator": "布伦特原油价格", "ifind_code": "S002868651", "ifind_field": "ths_commodity_price", "unit": "美元/桶"},
        {"indicator": "即期汇率(16:30):美元兑人民币", "ifind_code": "M004370159", "ifind_field": "ths_fx_spot", "unit": "元"},
        {"indicator": "标准普尔500波动率指数(VIX)", "ifind_code": "G002601505", "ifind_field": "ths_vix_index", "unit": "点"},
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
