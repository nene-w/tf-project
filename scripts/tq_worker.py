#!/usr/bin/env python3
"""
天勤量化TQSdk工作进程
通过stdin/stdout与Node.js后端通信（JSON协议）
"""
import sys
import os
import json
import time
import threading
import datetime

def send_msg(msg_type, data=None, message=None):
    """向Node.js发送JSON消息"""
    msg = {"type": msg_type}
    if data is not None:
        msg["data"] = data
    if message is not None:
        msg["message"] = message
    print(json.dumps(msg, ensure_ascii=False), flush=True)

def main():
    tq_username = os.environ.get("TQ_USERNAME", "")
    tq_password = os.environ.get("TQ_PASSWORD", "")
    contracts_str = os.environ.get("TQ_CONTRACTS", "KQ.m@CFFEX.T,KQ.m@CFFEX.TF,KQ.m@CFFEX.TS,KQ.m@CFFEX.TL")
    contracts = [c.strip() for c in contracts_str.split(",") if c.strip()]

    if not tq_username or not tq_password:
        send_msg("error", message="No TQ credentials provided")
        sys.exit(1)

    try:
        from tqsdk import TqApi, TqAuth
    except ImportError:
        send_msg("error", message="tqsdk not installed. Run: pip install tqsdk")
        sys.exit(1)

    try:
        api = TqApi(auth=TqAuth(tq_username, tq_password))
    except Exception as e:
        send_msg("error", message=f"TQSdk connection failed: {str(e)}")
        sys.exit(1)

    # 订阅行情
    quotes = {}
    klines_dict = {}
    
    for contract in contracts:
        try:
            quotes[contract] = api.get_quote(contract)
            # 订阅1分钟K线，获取最近200根
            klines_dict[contract] = api.get_kline_serial(contract, 60, 200)
        except Exception as e:
            send_msg("error", message=f"Failed to subscribe {contract}: {str(e)}")

    send_msg("ready")

    # 发送初始K线数据
    for contract, klines in klines_dict.items():
        try:
            bars = []
            for i in range(len(klines)):
                row = klines.iloc[i]
                bars.append({
                    "datetime": int(row["datetime"] / 1e6),  # 纳秒 -> 毫秒
                    "open": float(row["open"]) if not (row["open"] != row["open"]) else None,
                    "high": float(row["high"]) if not (row["high"] != row["high"]) else None,
                    "low": float(row["low"]) if not (row["low"] != row["low"]) else None,
                    "close": float(row["close"]) if not (row["close"] != row["close"]) else None,
                    "volume": float(row["volume"]) if not (row["volume"] != row["volume"]) else 0,
                    "openInterest": float(row.get("open_oi", 0)) if "open_oi" in row else 0,
                })
            send_msg("kline", data={"contract": contract, "period": 60, "bars": bars})
        except Exception as e:
            send_msg("error", message=f"Failed to send klines for {contract}: {str(e)}")

    # 主循环：等待行情更新
    while True:
        try:
            api.wait_update()
            
            # 检查行情变化
            quote_updates = []
            for contract, quote in quotes.items():
                if api.is_changing(quote):
                    try:
                        quote_updates.append({
                            "contract": contract,
                            "lastPrice": float(quote.last_price) if quote.last_price == quote.last_price else 0,
                            "bidPrice": float(quote.bid_price1) if quote.bid_price1 == quote.bid_price1 else 0,
                            "askPrice": float(quote.ask_price1) if quote.ask_price1 == quote.ask_price1 else 0,
                            "volume": int(quote.volume) if quote.volume == quote.volume else 0,
                            "openInterest": int(quote.open_interest) if quote.open_interest == quote.open_interest else 0,
                            "datetime": str(quote.datetime),
                            "change": float(quote.last_price - quote.pre_settlement) if quote.pre_settlement == quote.pre_settlement else 0,
                            "changePercent": float((quote.last_price - quote.pre_settlement) / quote.pre_settlement * 100) if quote.pre_settlement and quote.pre_settlement == quote.pre_settlement else 0,
                        })
                    except Exception:
                        pass
            
            if quote_updates:
                send_msg("quote", data=quote_updates)

            # 检查K线更新
            for contract, klines in klines_dict.items():
                if api.is_changing(klines.iloc[-1], "datetime"):
                    try:
                        last_bar = klines.iloc[-1]
                        send_msg("kline", data={
                            "contract": contract,
                            "period": 60,
                            "bars": [{
                                "datetime": int(last_bar["datetime"] / 1e6),
                                "open": float(last_bar["open"]),
                                "high": float(last_bar["high"]),
                                "low": float(last_bar["low"]),
                                "close": float(last_bar["close"]),
                                "volume": float(last_bar["volume"]),
                                "openInterest": float(last_bar.get("open_oi", 0)),
                            }]
                        })
                    except Exception:
                        pass

        except KeyboardInterrupt:
            break
        except Exception as e:
            send_msg("error", message=str(e))
            time.sleep(1)

    api.close()

if __name__ == "__main__":
    main()
