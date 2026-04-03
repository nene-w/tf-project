#!/usr/bin/env python3
"""
天勤量化数据服务 Python Worker
负责连接天勤，获取实时行情和K线数据，通过JSON格式推送给Node.js主进程

消息协议（stdout JSON Lines）：
  {"type": "ready",  "mode": "live"|"mock"}
  {"type": "quotes", "data": [...]}
  {"type": "klines", "contract": "...", "period": N, "data": [...]}   # 初始历史批量
  {"type": "kline",  "contract": "...", "period": N, "data": {...}}   # 单根K线更新（最后一根）
  {"type": "error",  "error": "..."}
"""

import sys
import json
import os
import time
import logging
from datetime import datetime, time as dt_time
from typing import Dict, List, Optional

# 配置日志（输出到 stderr，不污染 stdout）
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# ─── 配置 ──────────────────────────────────────────────────────────────────────
TQ_USERNAME = os.getenv('TQ_USERNAME', '')
TQ_PASSWORD = os.getenv('TQ_PASSWORD', '')
TQ_CONTRACTS = os.getenv(
    'TQ_CONTRACTS',
    'KQ.m@CFFEX.T,KQ.m@CFFEX.TF,KQ.m@CFFEX.TS,KQ.m@CFFEX.TL'
).split(',')

# 订阅多个周期的 K 线（秒）
KLINE_PERIODS = [60, 900, 3600, 86400]   # 1分钟、15分钟、1小时、日线

# 尝试导入天勤SDK
try:
    from tqsdk import TqApi, TqAuth
    HAS_TQSDK = True
except ImportError:
    HAS_TQSDK = False
    logger.warning("TQSdk not installed, using mock mode")


# ─── 工具函数 ──────────────────────────────────────────────────────────────────

def emit(msg: dict):
    """向Node.js主进程推送消息（stdout JSON Lines）"""
    print(json.dumps(msg, ensure_ascii=False), flush=True)


def float_or_zero(val) -> float:
    try:
        v = float(val)
        return 0.0 if (v != v) else v  # NaN → 0
    except (TypeError, ValueError):
        return 0.0


def int_or_zero(val) -> int:
    try:
        v = float(val)
        if v != v:
            return 0
        return int(v)
    except (TypeError, ValueError):
        return 0


def is_trading_time() -> bool:
    """判断当前是否为国债期货交易时间（9:30-11:30, 13:00-15:15）"""
    now = datetime.now()
    if now.weekday() >= 5:   # 周末
        return False
    t = now.time()
    return (dt_time(9, 30) <= t <= dt_time(11, 30)) or \
           (dt_time(13, 0) <= t <= dt_time(15, 15))


def bar_row_to_dict(row, contract: str, period: int) -> Optional[dict]:
    """
    将 pandas Series（K线行）转换为字典。
    datetime 字段：TQSdk 返回纳秒级 Unix 时间戳（int）。
    """
    try:
        dt_ns = int_or_zero(row.get('datetime', 0))
        if dt_ns <= 0:
            return None
        close = float_or_zero(row.get('close'))
        if close <= 0:
            return None
        return {
            'datetime': dt_ns,                          # 纳秒时间戳，原样传递
            'open':  float_or_zero(row.get('open')),
            'high':  float_or_zero(row.get('high')),
            'low':   float_or_zero(row.get('low')),
            'close': close,
            'volume': int_or_zero(row.get('volume')),
            'openInterest': int_or_zero(row.get('close_oi', 0)),
        }
    except Exception:
        return None


# ─── 真实天勤模式 ───────────────────────────────────────────────────────────────

def run_live_mode():
    """连接天勤，订阅实时行情 + 多周期 K 线"""
    logger.info(f"Connecting to TQ with account: {TQ_USERNAME}")
    try:
        api = TqApi(auth=TqAuth(TQ_USERNAME, TQ_PASSWORD), web_gui=False)
        logger.info("TQ API connected successfully")
    except Exception as e:
        logger.error(f"Failed to connect to TQ: {e}")
        emit({'type': 'error', 'error': str(e)})
        return False

    try:
        # ── 订阅行情 ──
        quotes = {}
        for contract in TQ_CONTRACTS:
            try:
                quotes[contract] = api.get_quote(contract)
                logger.info(f"Subscribed quote: {contract}")
            except Exception as e:
                logger.warning(f"Failed to subscribe quote {contract}: {e}")

        # ── 订阅多周期 K 线 ──
        # kline_series[contract][period] = DataFrame
        kline_series: Dict[str, Dict[int, object]] = {}
        for contract in TQ_CONTRACTS:
            kline_series[contract] = {}
            for period in KLINE_PERIODS:
                try:
                    # 获取最多 8000 根（TQSdk 上限），初始取 500 根足够展示
                    kls = api.get_kline_serial(contract, period, 500)
                    kline_series[contract][period] = kls
                    logger.info(f"Subscribed klines: {contract} period={period}s")
                except Exception as e:
                    logger.warning(f"Failed to subscribe klines {contract} {period}s: {e}")

        # ── 等待初始数据（最多 15 秒）──
        logger.info("Waiting for initial data...")
        deadline = time.time() + 15
        data_ready = False
        while time.time() < deadline:
            api.wait_update(deadline=time.time() + 1)
            # 检查任意一个合约的日线是否有数据
            for contract in TQ_CONTRACTS:
                kls = kline_series.get(contract, {}).get(86400)
                if kls is not None and len(kls) > 0:
                    last = kls.iloc[-1]
                    if float_or_zero(last.get('close')) > 0:
                        data_ready = True
                        break
            if data_ready:
                break

        if data_ready:
            logger.info("Initial data received")
        else:
            logger.warning("No initial data (possibly non-trading hours)")

        # ── 发送就绪信号 ──
        emit({'type': 'ready', 'mode': 'live'})

        # ── 推送初始 K 线历史数据 ──
        initialized: set = set()  # (contract, period)
        for contract in TQ_CONTRACTS:
            for period in KLINE_PERIODS:
                kls = kline_series.get(contract, {}).get(period)
                if kls is None or len(kls) == 0:
                    continue
                bars = []
                for i in range(len(kls)):
                    d = bar_row_to_dict(kls.iloc[i], contract, period)
                    if d:
                        bars.append(d)
                if bars:
                    emit({'type': 'klines', 'contract': contract, 'period': period, 'data': bars})
                    logger.info(f"Sent {len(bars)} initial klines for {contract} {period}s")
                    initialized.add((contract, period))

        # ── 主循环：实时推送 ──
        last_quote_time = 0.0

        while True:
            timeout = 2 if is_trading_time() else 5
            result = api.wait_update(deadline=time.time() + timeout)
            now = time.time()

            # 行情推送（每 2 秒一次）
            if now - last_quote_time >= 2:
                last_quote_time = now
                quote_list = []
                for contract, quote in quotes.items():
                    try:
                        last_price = float_or_zero(quote.last_price)
                        if last_price == 0:
                            continue
                        open_price = float_or_zero(getattr(quote, 'open', last_price))
                        change = last_price - open_price if open_price > 0 else 0
                        change_pct = (change / open_price * 100) if open_price > 0 else 0
                        quote_list.append({
                            'contract': contract,
                            'lastPrice': last_price,
                            'bidPrice': float_or_zero(getattr(quote, 'bid_price1', last_price)),
                            'askPrice': float_or_zero(getattr(quote, 'ask_price1', last_price)),
                            'volume': int_or_zero(quote.volume),
                            'openInterest': int_or_zero(quote.open_interest),
                            'datetime': str(quote.datetime) if quote.datetime else datetime.now().isoformat(),
                            'change': round(change, 3),
                            'changePercent': round(change_pct, 2),
                        })
                    except Exception as e:
                        logger.error(f"Error processing quote {contract}: {e}")
                if quote_list:
                    emit({'type': 'quotes', 'data': quote_list})

            # K 线实时更新（仅在交易时间且有数据变化时）
            if result:
                for contract in TQ_CONTRACTS:
                    for period in KLINE_PERIODS:
                        if (contract, period) not in initialized:
                            continue
                        kls = kline_series.get(contract, {}).get(period)
                        if kls is None or len(kls) == 0:
                            continue
                        try:
                            last_bar = kls.iloc[-1]
                            # is_changing 检测最后一根 K 线是否有任何字段变化
                            if api.is_changing(last_bar):
                                d = bar_row_to_dict(last_bar, contract, period)
                                if d:
                                    emit({
                                        'type': 'kline',
                                        'contract': contract,
                                        'period': period,
                                        'data': d,
                                        # 同时发送倒数第二根（防止新K线生成时最后一根是空的）
                                        'prev': bar_row_to_dict(kls.iloc[-2], contract, period) if len(kls) >= 2 else None,
                                    })
                        except Exception as e:
                            logger.error(f"Error processing kline update {contract} {period}s: {e}")

    except KeyboardInterrupt:
        logger.info("Worker shutting down (KeyboardInterrupt)")
    except Exception as e:
        logger.error(f"Worker error: {e}", exc_info=True)
        emit({'type': 'error', 'error': str(e)})
    finally:
        try:
            api.close()
        except Exception:
            pass

    return True


# ─── 模拟数据模式 ───────────────────────────────────────────────────────────────

class MockQuoteProvider:
    """模拟行情数据提供者（用于无天勤账号时的界面测试）"""

    BASE_PRICES = {
        'KQ.m@CFFEX.T':  103.5,
        'KQ.m@CFFEX.TF': 104.2,
        'KQ.m@CFFEX.TS': 101.8,
        'KQ.m@CFFEX.TL': 108.6,
    }

    def __init__(self, contracts: List[str]):
        self.contracts = contracts
        self.current_prices = {c: self.BASE_PRICES.get(c, 100.0) for c in contracts}

    def tick_prices(self):
        import random
        for c in self.contracts:
            base = self.BASE_PRICES.get(c, 100.0)
            cur = self.current_prices[c]
            delta = (random.random() - 0.495) * 0.05
            self.current_prices[c] = max(base * 0.95, min(base * 1.05, cur + delta))

    def get_quotes(self) -> List[dict]:
        import random
        self.tick_prices()
        result = []
        for c in self.contracts:
            base = self.BASE_PRICES.get(c, 100.0)
            price = self.current_prices[c]
            change = price - base
            result.append({
                'contract': c,
                'lastPrice': round(price, 3),
                'bidPrice':  round(price - 0.002, 3),
                'askPrice':  round(price + 0.002, 3),
                'volume': int(random.random() * 1000 + 500),
                'openInterest': int(random.random() * 10000 + 80000),
                'datetime': datetime.now().isoformat(),
                'change': round(change, 3),
                'changePercent': round((change / base) * 100, 2),
            })
        return result

    def get_klines(self, contract: str, period: int, count: int = 300) -> List[dict]:
        import random
        base = self.BASE_PRICES.get(contract, 100.0)
        bars = []
        # 使用纳秒时间戳，与真实数据格式一致
        now_ns = int(time.time()) * 1_000_000_000
        price = base
        for i in range(count):
            ts_ns = now_ns - (count - i) * period * 1_000_000_000
            o = price
            c = o + (random.random() - 0.5) * 0.3
            h = max(o, c) + random.random() * 0.1
            l = min(o, c) - random.random() * 0.1
            v = int(random.random() * 500 + 100)
            price = c
            bars.append({
                'datetime': ts_ns,
                'open':  round(o, 3),
                'high':  round(h, 3),
                'low':   round(l, 3),
                'close': round(c, 3),
                'volume': v,
                'openInterest': int(random.random() * 10000 + 80000),
            })
        return bars


def run_mock_mode():
    """运行模拟数据模式"""
    logger.info("Starting mock data mode")
    provider = MockQuoteProvider(TQ_CONTRACTS)

    emit({'type': 'ready', 'mode': 'mock'})

    # 推送初始 K 线（所有周期）
    for contract in TQ_CONTRACTS:
        for period in KLINE_PERIODS:
            bars = provider.get_klines(contract, period)
            emit({'type': 'klines', 'contract': contract, 'period': period, 'data': bars})

    # 主循环：每 2 秒推送行情 + 更新最后一根 K 线
    import random
    tick_count = 0
    try:
        while True:
            time.sleep(2)
            tick_count += 1

            # 推送行情
            quotes = provider.get_quotes()
            emit({'type': 'quotes', 'data': quotes})

            # 每 2 秒更新一次最后一根 K 线（模拟盘中更新）
            now_ns = int(time.time()) * 1_000_000_000
            for contract in TQ_CONTRACTS:
                price = provider.current_prices[contract]
                for period in KLINE_PERIODS:
                    # 计算当前 K 线的起始时间（对齐到周期）
                    period_ns = period * 1_000_000_000
                    bar_start_ns = (now_ns // period_ns) * period_ns
                    bar = {
                        'datetime': bar_start_ns,
                        'open':  round(price + (random.random() - 0.5) * 0.05, 3),
                        'high':  round(price + random.random() * 0.1, 3),
                        'low':   round(price - random.random() * 0.1, 3),
                        'close': round(price, 3),
                        'volume': int(random.random() * 200 + 50),
                        'openInterest': int(random.random() * 10000 + 80000),
                    }
                    emit({'type': 'kline', 'contract': contract, 'period': period, 'data': bar})

    except KeyboardInterrupt:
        logger.info("Mock worker shutting down")


# ─── 入口 ───────────────────────────────────────────────────────────────────────

def main():
    logger.info(f"TQ Worker starting | contracts: {TQ_CONTRACTS} | periods: {KLINE_PERIODS}")
    logger.info(f"Trading time: {is_trading_time()}")

    if HAS_TQSDK and TQ_USERNAME and TQ_PASSWORD:
        logger.info("Using real TQ data provider")
        success = run_live_mode()
        if not success:
            logger.warning("Falling back to mock mode")
            run_mock_mode()
    else:
        logger.info("Using mock data provider (no TQ credentials)")
        run_mock_mode()


if __name__ == '__main__':
    main()
