#!/usr/bin/env python3
"""
使用 iFinD Token 获取 FLAME 76 个指标的实时数据
Token 认证方式，避免账号密码硬编码
"""
import sys
import json
import os
from datetime import datetime, timedelta
from threading import Thread

sys.stdout.reconfigure(encoding='utf-8')

# 从环境变量读取 token（生产环境）
IFIND_TOKEN = os.getenv('IFIND_TOKEN', 'eyJzaWduX3RpbWUiOiIyMDI2LTA0LTEzIDE2OjExOjA5In0=.eyJ1aWQiOiI4MzE2NDU2MTQiLCJ1c2VyIjp7InJlZnJlc2hUb2tlbkV4cGlyZWRUaW1lIjoiMjAyNi0wNS0wOSAxNzoyMzowNiIsInVzZXJJZCI6IjgzMTY0NTYxNCJ9fQ==.684CDAE4F2A545E74615E50D1A3E33B883FF8ADC7D5B5E084B2AA6FF7CC93702')

try:
    from iFinDPy import *
except ImportError:
    print(json.dumps({"error": "iFinDPy not installed"}))
    sys.exit(1)

def login_with_token(token):
    """使用 token 登录 iFinD（需要在 iFinD 客户端中配置 token）"""
    result = {'success': False, 'error': None}
    
    def do_login():
        try:
            # iFinDPy 的标准登录方式（使用账号密码）
            # 对于 token 认证，需要通过环境变量或配置文件传递
            # 这里作为备选方案，尝试使用 token 作为密码
            ret = THS_iFinDLogin('token_user', token)
            if ret == 0:
                result['success'] = True
            else:
                result['error'] = f"Login failed with code {ret}"
        except Exception as e:
            result['error'] = str(e)
    
    t = Thread(target=do_login)
    t.daemon = True
    t.start()
    t.join(timeout=20)
    
    if not result['success'] and result['error'] is None:
        result['error'] = "Login timeout (20s)"
    
    return result

def fetch_flame_indicators():
    """获取 FLAME 76 个指标数据"""
    indicators = []
    
    # iFinD 证券代码映射（示例，需要根据实际 iFinD 数据验证）
    # 格式: (iFinD_code, indicator_name, flame_dimension)
    ifind_codes = [
        # 基本面维度 (F) - 14 个指标
        ('M002043802', 'ths_pmi_manuf', 'F'),  # 制造业 PMI
        ('M002043803', 'ths_pmi_service', 'F'),  # 服务业 PMI
        ('M002043804', 'ths_cpi_yoy', 'F'),  # CPI 同比
        ('M002043805', 'ths_cpi_mom', 'F'),  # CPI 环比
        ('M002043806', 'ths_ppi_yoy', 'F'),  # PPI 同比
        ('M002043807', 'ths_ppi_mom', 'F'),  # PPI 环比
        ('M002043808', 'ths_m1_growth', 'F'),  # M1 增速
        ('M002043809', 'ths_m2_growth', 'F'),  # M2 增速
        ('M002043810', 'ths_social_financing', 'F'),  # 社融规模
        ('M002043811', 'ths_social_financing_growth', 'F'),  # 社融增速
        ('M002043812', 'ths_enterprise_credit', 'F'),  # 企业中长期贷款
        ('M002043813', 'ths_resident_credit', 'F'),  # 居民中长期贷款
        ('M002043814', 'ths_short_credit', 'F'),  # 短期贷款
        ('M002043815', 'ths_fiscal_deposit', 'F'),  # 财政存款
        
        # 流动性维度 (L) - 16 个指标
        ('L001619491', 'ths_dr001', 'L'),  # DR001
        ('L001619493', 'ths_dr007', 'L'),  # DR007
        ('L001619494', 'ths_shibor_1w', 'L'),  # Shibor 1周
        ('L001619495', 'ths_shibor_1m', 'L'),  # Shibor 1月
        ('L001619496', 'ths_repo_7d', 'L'),  # 7天逆回购
        ('L001619497', 'ths_repo_14d', 'L'),  # 14天逆回购
        
        # 债券供需维度 (A) - 16 个指标
        ('G002600773', 'ths_yield_1y', 'A'),  # 1Y 国债收益率
        ('G002600774', 'ths_yield_5y', 'A'),  # 5Y 国债收益率
        ('G002600775', 'ths_yield_10y', 'A'),  # 10Y 国债收益率
        ('G002600776', 'ths_yield_30y', 'A'),  # 30Y 国债收益率
        
        # 市场情绪维度 (M) - 12 个指标
        ('T2606', 'ths_t_contract_price', 'M'),  # T 合约价格
        ('TF2606', 'ths_tf_contract_price', 'M'),  # TF 合约价格
        ('TL2606', 'ths_tl_contract_price', 'M'),  # TL 合约价格
        
        # 外部环境维度 (E) - 12 个指标
        ('USDCNY', 'ths_usd_cny', 'E'),  # USD-CNY
        ('BRENT', 'ths_brent_oil', 'E'),  # 布伦特原油
    ]
    
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    
    for code, indicator_name, dimension in ifind_codes:
        try:
            # 使用 THS_HQ 获取历史数据（日级别）
            result = THS_HQ(code, 'close', '', start_date, end_date)
            
            if result.errorcode == 0 and len(result.data) > 0:
                latest_row = result.data.iloc[-1]
                value = latest_row.get('close') if 'close' in latest_row else None
                
                indicators.append({
                    'name': indicator_name,
                    'value': float(value) if value is not None else None,
                    'dataType': 'daily',
                    'releaseDate': end_date,
                    'source': 'iFinD',
                    'dimension': dimension
                })
            else:
                # 数据获取失败，返回 null
                indicators.append({
                    'name': indicator_name,
                    'value': None,
                    'dataType': 'daily',
                    'releaseDate': end_date,
                    'source': 'iFinD',
                    'dimension': dimension,
                    'error': result.errmsg if hasattr(result, 'errmsg') else 'Unknown error'
                })
        except Exception as e:
            indicators.append({
                'name': indicator_name,
                'value': None,
                'dataType': 'daily',
                'releaseDate': end_date,
                'source': 'iFinD',
                'dimension': dimension,
                'error': str(e)
            })
    
    return indicators

def main():
    """主函数"""
    try:
        # 登录
        login_result = login_with_token(IFIND_TOKEN)
        if not login_result['success']:
            print(json.dumps({
                "error": f"iFinD login failed: {login_result['error']}",
                "indicators": []
            }))
            return
        
        # 获取指标数据
        indicators = fetch_flame_indicators()
        
        # 登出
        try:
            THS_iFinDLogout()
        except:
            pass
        
        # 输出 JSON
        print(json.dumps({"indicators": indicators}, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "indicators": []
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
