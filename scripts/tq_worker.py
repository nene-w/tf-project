#!/usr/bin/env python3
"""
天勤量化数据服务 Python Worker
负责连接天勤稳定，获取实时行情和K线数据，通过JSON格式推送给Node.js主进程
"""

import sys
import json
import os
import time
import logging
from datetime import datetime
from typing import Dict, List, Optional

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# 从环境变量读取配置
TQ_USERNAME = os.getenv('TQ_USERNAME', '')
TQ_PASSWORD = os.getenv('TQ_PASSWORD', '')
TQ_CONTRACTS = os.getenv('TQ_CONTRACTS', 'KQ.m@CFFEX.T,KQ.m@CFFEX.TF,KQ.m@CFFEX.TS,KQ.m@CFFEX.TL').split(',')

# 尝试导入天勤SDK
try:
    from tqsdk import TqApi, TqAuth
    HAS_TQSDK = True
except ImportError:
    HAS_TQSDK = False
    logger.warning("TQSdk not installed, using mock mode")


class MockQuoteProvider:
    """模拟行情数据提供者"""
    
    def __init__(self, contracts: List[str]):
        self.contracts = contracts
        self.base_prices = {
            'KQ.m@CFFEX.T': 103.5,
            'KQ.m@CFFEX.TF': 104.2,
            'KQ.m@CFFEX.TS': 101.8,
            'KQ.m@CFFEX.TL': 108.6,
        }
        self.current_prices = self.base_prices.copy()
    
    def get_quotes(self) -> List[Dict]:
        """获取模拟行情"""
        import random
        
        quotes = []
        for contract in self.contracts:
            base_price = self.base_prices.get(contract, 100)
            current = self.current_prices.get(contract, base_price)
            
            # 随机波动
            change = (random.random() - 0.495) * 0.05
            new_price = max(
                base_price * 0.95,
                min(base_price * 1.05, current + change)
            )
            self.current_prices[contract] = new_price
            
            change_amount = new_price - base_price
            change_percent = (change_amount / base_price) * 100 if base_price > 0 else 0
            
            quotes.append({
                'contract': contract,
                'lastPrice': round(new_price, 3),
                'bidPrice': round(new_price - 0.002, 3),
                'askPrice': round(new_price + 0.002, 3),
                'volume': int(random.random() * 1000 + 500),
                'openInterest': int(random.random() * 10000 + 80000),
                'datetime': datetime.now().isoformat(),
                'change': round(change_amount, 3),
                'changePercent': round(change_percent, 2),
            })
        
        return quotes


class TQDataProvider:
    """真实天勤数据提供者"""
    
    def __init__(self, username: str, password: str, contracts: List[str]):
        self.username = username
        self.password = password
        self.contracts = contracts
        self.api = None
        self.account = None
        self.quotes = {}
        
    def connect(self) -> bool:
        """连接天勤"""
        try:
            # 使用 TqAuth 连接到天勤
            self.api = TqApi(auth=TqAuth(self.username, self.password), web_gui=False)
            logger.info(f"Connected to TQ with account: {self.username}")
            
            # 订阅合约
            for contract in self.contracts:
                try:
                    quote = self.api.get_quote(contract)
                    self.quotes[contract] = quote
                    logger.info(f"Subscribed to {contract}")
                except Exception as e:
                    logger.warning(f"Failed to subscribe to {contract}: {e}")
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to TQ: {e}")
            return False
    
    def get_quotes(self) -> List[Dict]:
        """获取实时行情"""
        quotes = []
        try:
            for contract in self.contracts:
                if contract in self.quotes:
                    quote = self.quotes[contract]
                    # TQSdk Quote 对象的属性名是 bid_price1, ask_price1 等
                    bid_price = quote.bid_price1 if hasattr(quote, 'bid_price1') else quote.last_price
                    ask_price = quote.ask_price1 if hasattr(quote, 'ask_price1') else quote.last_price
                    open_price = quote.open if hasattr(quote, 'open') else quote.last_price
                    
                    quotes.append({
                        'contract': contract,
                        'lastPrice': float(quote.last_price) if quote.last_price else 0,
                        'bidPrice': float(bid_price) if bid_price else 0,
                        'askPrice': float(ask_price) if ask_price else 0,
                        'volume': int(quote.volume) if quote.volume else 0,
                        'openInterest': int(quote.open_interest) if quote.open_interest else 0,
                        'datetime': str(quote.datetime) if quote.datetime else datetime.now().isoformat(),
                        'change': float(quote.last_price - open_price) if (quote.last_price and open_price) else 0,
                        'changePercent': 0,  # 需要计算
                    })
        except Exception as e:
            logger.error(f"Error getting quotes: {e}")
        
        return quotes
    
    def close(self):
        """关闭连接"""
        if self.api:
            self.api.close()


def main():
    """主程序"""
    logger.info(f"TQ Worker starting with contracts: {TQ_CONTRACTS}")
    
    # 选择数据提供者
    if HAS_TQSDK and TQ_USERNAME and TQ_PASSWORD:
        logger.info("Using real TQ data provider")
        provider = TQDataProvider(TQ_USERNAME, TQ_PASSWORD, TQ_CONTRACTS)
        if not provider.connect():
            logger.warning("Failed to connect to TQ, falling back to mock mode")
            provider = MockQuoteProvider(TQ_CONTRACTS)
    else:
        logger.info("Using mock data provider")
        provider = MockQuoteProvider(TQ_CONTRACTS)
    
    # 通知主进程已准备好
    print(json.dumps({'type': 'ready', 'mode': 'live' if HAS_TQSDK and TQ_USERNAME else 'mock'}))
    sys.stdout.flush()
    
    # 主循环：定期推送行情数据
    try:
        while True:
            time.sleep(2)  # 每2秒推送一次
            
            quotes = provider.get_quotes()
            if quotes:
                print(json.dumps({'type': 'quotes', 'data': quotes}))
                sys.stdout.flush()
    
    except KeyboardInterrupt:
        logger.info("Worker shutting down")
        if isinstance(provider, TQDataProvider):
            provider.close()
    except Exception as e:
        logger.error(f"Worker error: {e}")
        print(json.dumps({'type': 'error', 'error': str(e)}))
        sys.stdout.flush()


if __name__ == '__main__':
    main()
