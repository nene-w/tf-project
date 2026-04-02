#!/usr/bin/env python3
"""
天勤量化数据服务 Python Worker
负责连接天勤稳定，获取实时行情和K线数据，通过JSON格式推送给Node.js主进程
支持交易时间和非交易时间
"""

import sys
import json
import os
import time
import logging
from datetime import datetime, time as dt_time
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
TQ_KLINE_PERIOD = int(os.getenv('TQ_KLINE_PERIOD', '60'))  # K线周期（秒）

# 尝试导入天勤SDK
try:
    from tqsdk import TqApi, TqAuth
    HAS_TQSDK = True
except ImportError:
    HAS_TQSDK = False
    logger.warning("TQSdk not installed, using mock mode")


def emit(msg: dict):
    """向Node.js主进程推送消息"""
    print(json.dumps(msg, ensure_ascii=False), flush=True)


def float_or_zero(val):
    """安全地转换为float"""
    try:
        v = float(val)
        return 0.0 if (v != v) else v  # NaN check
    except (TypeError, ValueError):
        return 0.0


def int_or_zero(val):
    """安全地转换为int"""
    try:
        v = float(val)
        if v != v:  # NaN check
            return 0
        return int(v)
    except (TypeError, ValueError):
        return 0


def is_trading_time() -> bool:
    """判断当前是否为交易时间（简化版）"""
    now = datetime.now()
    current_time = now.time()
    
    # 国债期货交易时间：9:30-11:30, 13:00-15:15
    morning_start = dt_time(9, 30)
    morning_end = dt_time(11, 30)
    afternoon_start = dt_time(13, 0)
    afternoon_end = dt_time(15, 15)
    
    is_morning = morning_start <= current_time <= morning_end
    is_afternoon = afternoon_start <= current_time <= afternoon_end
    
    # 周末不交易
    is_weekday = now.weekday() < 5
    
    return is_weekday and (is_morning or is_afternoon)


def bar_to_dict(bar, contract: str, period: int) -> dict:
    """将K线数据转换为字典"""
    dt = bar.get('datetime', 0)
    if hasattr(dt, 'timestamp'):
        dt_ms = int(dt.timestamp() * 1000)
    elif isinstance(dt, (int, float)):
        # TQSdk 使用纳秒时间戳
        dt_ms = int(dt) // 1000000
    else:
        dt_ms = int(time.time() * 1000)
    
    return {
        'datetime': dt_ms,
        'open': float_or_zero(bar.get('open')),
        'high': float_or_zero(bar.get('high')),
        'low': float_or_zero(bar.get('low')),
        'close': float_or_zero(bar.get('close')),
        'volume': int_or_zero(bar.get('volume')),
        'openInterest': int_or_zero(bar.get('open_oi', 0)),
    }


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
    
    def get_klines(self, contract: str, period: int, count: int = 200) -> List[Dict]:
        """获取模拟K线数据"""
        import random
        
        base_price = self.base_prices.get(contract, 100)
        bars = []
        now_ms = int(time.time() * 1000)
        
        for i in range(count):
            t = now_ms - (count - i) * period * 1000
            o = base_price + (random.random() - 0.5) * 0.5
            c = o + (random.random() - 0.5) * 0.3
            h = max(o, c) + random.random() * 0.1
            l = min(o, c) - random.random() * 0.1
            v = int(random.random() * 500 + 100)
            
            bars.append({
                'datetime': t,
                'open': round(o, 3),
                'high': round(h, 3),
                'low': round(l, 3),
                'close': round(c, 3),
                'volume': v,
                'openInterest': int(random.random() * 10000 + 80000),
            })
        
        return bars


def run_live_mode():
    """运行真实天勤数据模式"""
    logger.info(f"Connecting to TQ with account: {TQ_USERNAME}")
    
    try:
        api = TqApi(auth=TqAuth(TQ_USERNAME, TQ_PASSWORD), web_gui=False)
        logger.info("TQ API connected successfully")
    except Exception as e:
        logger.error(f"Failed to connect to TQ: {e}")
        emit({'type': 'error', 'error': str(e)})
        return False
    
    try:
        # 订阅行情
        quotes = {}
        for contract in TQ_CONTRACTS:
            try:
                quotes[contract] = api.get_quote(contract)
                logger.info(f"Subscribed to quote: {contract}")
            except Exception as e:
                logger.warning(f"Failed to subscribe to {contract}: {e}")
        
        # 订阅K线数据
        kline_series = {}
        for contract in TQ_CONTRACTS:
            try:
                klines = api.get_kline_serial(contract, TQ_KLINE_PERIOD, 200)
                kline_series[contract] = klines
                logger.info(f"Subscribed to klines: {contract} period={TQ_KLINE_PERIOD}s")
            except Exception as e:
                logger.warning(f"Failed to subscribe klines for {contract}: {e}")
        
        # 等待初始数据（最多等待10秒）
        logger.info("Waiting for initial data...")
        deadline = time.time() + 10
        data_ready = False
        
        while time.time() < deadline:
            result = api.wait_update(deadline=time.time() + 1)
            if result:
                # 检查是否有有效数据
                try:
                    for contract, klines in kline_series.items():
                        if len(klines) > 0:
                            last_bar = klines.iloc[-1]
                            if float_or_zero(last_bar.get('close')) > 0:
                                data_ready = True
                                break
                    if data_ready:
                        break
                except:
                    pass
        
        if data_ready:
            logger.info("Initial data received")
        else:
            logger.warning("No initial data received (possibly non-trading hours)")
        
        # 发送就绪信号
        emit({'type': 'ready', 'mode': 'live'})
        
        # 推送初始K线数据
        klines_sent = set()
        for contract, klines in kline_series.items():
            try:
                if len(klines) > 0:
                    bars = []
                    for i in range(len(klines)):
                        bar = klines.iloc[i]
                        bar_dict = bar_to_dict(bar, contract, TQ_KLINE_PERIOD)
                        if bar_dict['datetime'] > 0 and bar_dict['close'] > 0:
                            bars.append(bar_dict)
                    
                    if bars:
                        emit({'type': 'klines', 'contract': contract, 'period': TQ_KLINE_PERIOD, 'data': bars})
                        logger.info(f"Sent {len(bars)} initial klines for {contract}")
                        klines_sent.add(contract)
            except Exception as e:
                logger.error(f"Error sending initial klines for {contract}: {e}")
        
        # 主循环
        last_quote_time = 0
        
        while True:
            # 在非交易时间使用较长的超时，避免阻塞
            if is_trading_time():
                result = api.wait_update(deadline=time.time() + 2)
            else:
                result = api.wait_update(deadline=time.time() + 5)
            
            now = time.time()
            
            # 推送行情（每2秒一次）
            if now - last_quote_time >= 2:
                last_quote_time = now
                quote_list = []
                for contract, quote in quotes.items():
                    try:
                        last_price = float_or_zero(quote.last_price)
                        if last_price == 0:
                            continue
                        
                        bid_price = float_or_zero(getattr(quote, 'bid_price1', last_price))
                        ask_price = float_or_zero(getattr(quote, 'ask_price1', last_price))
                        open_price = float_or_zero(getattr(quote, 'open', last_price))
                        
                        change = last_price - open_price if open_price > 0 else 0
                        change_pct = (change / open_price * 100) if open_price > 0 else 0
                        
                        quote_list.append({
                            'contract': contract,
                            'lastPrice': last_price,
                            'bidPrice': bid_price,
                            'askPrice': ask_price,
                            'volume': int_or_zero(quote.volume),
                            'openInterest': int_or_zero(quote.open_interest),
                            'datetime': str(quote.datetime) if quote.datetime else datetime.now().isoformat(),
                            'change': round(change, 3),
                            'changePercent': round(change_pct, 2),
                        })
                    except Exception as e:
                        logger.error(f"Error processing quote for {contract}: {e}")
                
                if quote_list:
                    emit({'type': 'quotes', 'data': quote_list})
            
            # 推送K线更新（仅在交易时间）
            if result and is_trading_time():
                for contract, klines in kline_series.items():
                    if contract not in klines_sent:
                        continue
                    try:
                        last_bar = klines.iloc[-1]
                        if api.is_changing(last_bar):
                            bar_dict = bar_to_dict(last_bar, contract, TQ_KLINE_PERIOD)
                            if bar_dict['datetime'] > 0:
                                emit({
                                    'type': 'kline',
                                    'contract': contract,
                                    'period': TQ_KLINE_PERIOD,
                                    'data': bar_dict
                                })
                    except Exception as e:
                        logger.error(f"Error processing kline update for {contract}: {e}")
    
    except KeyboardInterrupt:
        logger.info("Worker shutting down")
    except Exception as e:
        logger.error(f"Worker error: {e}")
        emit({'type': 'error', 'error': str(e)})
    finally:
        try:
            api.close()
        except:
            pass
    
    return True


def run_mock_mode():
    """运行模拟数据模式"""
    logger.info("Starting mock data mode")
    provider = MockQuoteProvider(TQ_CONTRACTS)
    
    emit({'type': 'ready', 'mode': 'mock'})
    
    # 推送初始K线数据
    for contract in TQ_CONTRACTS:
        klines = provider.get_klines(contract, TQ_KLINE_PERIOD)
        emit({'type': 'klines', 'contract': contract, 'period': TQ_KLINE_PERIOD, 'data': klines})
    
    # 主循环
    try:
        while True:
            time.sleep(2)
            quotes = provider.get_quotes()
            if quotes:
                emit({'type': 'quotes', 'data': quotes})
    except KeyboardInterrupt:
        logger.info("Mock worker shutting down")


def main():
    """主程序"""
    logger.info(f"TQ Worker starting with contracts: {TQ_CONTRACTS}, period: {TQ_KLINE_PERIOD}s")
    logger.info(f"Trading time: {is_trading_time()}")
    
    if HAS_TQSDK and TQ_USERNAME and TQ_PASSWORD:
        logger.info("Using real TQ data provider")
        success = run_live_mode()
        if not success:
            logger.warning("Falling back to mock mode")
            run_mock_mode()
    else:
        logger.info("Using mock data provider")
        run_mock_mode()


if __name__ == '__main__':
    main()
