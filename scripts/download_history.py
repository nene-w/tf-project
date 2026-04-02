#!/usr/bin/env python3
"""
天勤历史 K 线数据下载脚本
根据官方文档 https://doc.shinnytech.com/tqsdk/latest/usage/mddatas.html
使用 get_kline_serial() 下载最近 180 天的历史数据

用法：
  python3 scripts/download_history.py

环境变量：
  TQ_USERNAME  - 天勤快期账号
  TQ_PASSWORD  - 天勤快期密码
  DATABASE_URL - MySQL/TiDB 连接字符串（可选，若不提供则输出 JSON）
"""

import sys
import os
import json
import time
import logging
from datetime import datetime, timedelta

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# ─── 配置 ───────────────────────────────────────────────────────────────────
TQ_USERNAME = os.getenv('TQ_USERNAME', 'palmdale')
TQ_PASSWORD = os.getenv('TQ_PASSWORD', 'a2205570a')

# 国债期货四个主连合约
CONTRACTS = [
    'KQ.m@CFFEX.T',   # 10年期国债期货主连
    'KQ.m@CFFEX.TF',  # 5年期国债期货主连
    'KQ.m@CFFEX.TS',  # 2年期国债期货主连
    'KQ.m@CFFEX.TL',  # 30年期国债期货主连
]

# 下载的 K 线周期（秒）
# 86400 = 日线，3600 = 60分钟线，900 = 15分钟线，300 = 5分钟线，60 = 1分钟线
PERIODS = {
    86400: '日线',
    3600:  '60分钟线',
    900:   '15分钟线',
    300:   '5分钟线',
    60:    '1分钟线',
}

# 180 天对应的 K 线根数估算（每个周期）
# 国债期货每天约 4.75 小时交易时间
TRADING_HOURS_PER_DAY = 4.75
DAYS = 180

BAR_COUNTS = {
    86400: DAYS,                                          # 日线：约 130 个交易日（180 自然日）
    3600:  int(DAYS * TRADING_HOURS_PER_DAY),             # 60分钟：约 855 根
    900:   int(DAYS * TRADING_HOURS_PER_DAY * 4),         # 15分钟：约 3420 根
    300:   int(DAYS * TRADING_HOURS_PER_DAY * 12),        # 5分钟：约 10260 根（超过 8000 上限，取 8000）
    60:    8000,                                          # 1分钟：最大 8000 根
}

# TQSdk 每个序列最多 8000 根
MAX_BARS = 8000


def float_or_nan(val):
    """安全转换为 float，NaN 返回 None"""
    try:
        v = float(val)
        if v != v:  # NaN
            return None
        return v
    except (TypeError, ValueError):
        return None


def int_or_zero(val):
    """安全转换为 int"""
    try:
        v = float(val)
        if v != v:
            return 0
        return int(v)
    except (TypeError, ValueError):
        return 0


def ns_to_ms(ns_timestamp):
    """纳秒时间戳转毫秒"""
    return int(ns_timestamp) // 1_000_000


def kline_row_to_dict(row, contract: str, period: int) -> dict | None:
    """将 DataFrame 行转换为字典，过滤无效数据"""
    dt_ns = row.get('datetime', 0)
    if isinstance(dt_ns, (int, float)):
        dt_ns = int(dt_ns)
    else:
        return None

    if dt_ns <= 0:
        return None

    close = float_or_nan(row.get('close'))
    if close is None or close <= 0:
        return None

    return {
        'contract': contract,
        'period': period,
        'datetime': dt_ns,           # 纳秒时间戳（存入 DB）
        'datetime_ms': ns_to_ms(dt_ns),  # 毫秒时间戳（供前端使用）
        'datetime_str': datetime.fromtimestamp(dt_ns / 1e9).strftime('%Y-%m-%d %H:%M:%S'),
        'open': float_or_nan(row.get('open')),
        'high': float_or_nan(row.get('high')),
        'low': float_or_nan(row.get('low')),
        'close': close,
        'volume': int_or_zero(row.get('volume')),
        'open_interest': int_or_zero(row.get('open_oi', 0)),
    }


def download_with_tqsdk(periods_to_download=None):
    """使用 TQSdk 下载历史 K 线数据"""
    try:
        from tqsdk import TqApi, TqAuth
    except ImportError:
        logger.error("TQSdk 未安装，请运行: pip install tqsdk")
        sys.exit(1)

    if periods_to_download is None:
        periods_to_download = list(PERIODS.keys())

    logger.info(f"正在连接天勤，账号: {TQ_USERNAME}")
    logger.info(f"将下载 {len(CONTRACTS)} 个合约 × {len(periods_to_download)} 个周期的历史数据")
    logger.info(f"目标周期: {[PERIODS[p] for p in periods_to_download]}")

    try:
        api = TqApi(auth=TqAuth(TQ_USERNAME, TQ_PASSWORD), web_gui=False)
        logger.info("天勤连接成功")
    except Exception as e:
        logger.error(f"连接天勤失败: {e}")
        sys.exit(1)

    all_results = {}  # {contract: {period: [bars]}}

    try:
        # 逐合约逐周期下载（避免同时订阅太多序列）
        for contract in CONTRACTS:
            all_results[contract] = {}
            logger.info(f"\n{'='*50}")
            logger.info(f"开始下载合约: {contract}")

            for period in periods_to_download:
                period_name = PERIODS[period]
                bar_count = min(BAR_COUNTS.get(period, 200), MAX_BARS)

                logger.info(f"  下载 {period_name}（{period}s），请求 {bar_count} 根...")

                try:
                    # 根据官方文档：get_kline_serial(symbol, duration_seconds, data_length)
                    klines = api.get_kline_serial(contract, period, bar_count)

                    # 等待数据就绪（最多等待 30 秒）
                    deadline = time.time() + 30
                    while time.time() < deadline:
                        api.wait_update(deadline=time.time() + 2)
                        # 检查数据是否已加载
                        if len(klines) > 0:
                            last = klines.iloc[-1]
                            if float_or_nan(last.get('close')) is not None:
                                break

                    # 转换数据
                    bars = []
                    for i in range(len(klines)):
                        row = klines.iloc[i]
                        bar = kline_row_to_dict(row, contract, period)
                        if bar is not None:
                            bars.append(bar)

                    all_results[contract][period] = bars
                    logger.info(f"  ✓ {period_name}: 获取到 {len(bars)} 根有效 K 线")

                    if bars:
                        oldest = bars[0]['datetime_str']
                        newest = bars[-1]['datetime_str']
                        logger.info(f"    时间范围: {oldest} ~ {newest}")

                except Exception as e:
                    logger.error(f"  ✗ {period_name} 下载失败: {e}")
                    all_results[contract][period] = []

    except KeyboardInterrupt:
        logger.info("用户中断下载")
    finally:
        try:
            api.close()
            logger.info("天勤连接已关闭")
        except Exception:
            pass

    return all_results


def save_to_database(all_results: dict):
    """将数据保存到数据库（通过 Node.js 后端 API 或直接 MySQL）"""
    database_url = os.getenv('DATABASE_URL', '')

    if not database_url:
        logger.warning("DATABASE_URL 未设置，将数据输出为 JSON 格式")
        output_json(all_results)
        return

    try:
        import pymysql
        import re

        # 解析 DATABASE_URL: mysql://user:pass@host:port/dbname
        match = re.match(
            r'mysql(?:\+pymysql)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)',
            database_url
        )
        if not match:
            logger.error(f"无法解析 DATABASE_URL: {database_url}")
            output_json(all_results)
            return

        user, password, host, port, dbname = match.groups()
        port = int(port) if port else 3306
        # 去掉 dbname 中可能的查询参数
        dbname = dbname.split('?')[0]

        logger.info(f"连接数据库: {host}:{port}/{dbname}")

        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=dbname,
            ssl={'ssl': True} if 'tidb' in host or 'ssl' in database_url.lower() else None,
            charset='utf8mb4',
            autocommit=False,
        )

        cursor = conn.cursor()

        total_inserted = 0
        total_skipped = 0

        for contract, periods_data in all_results.items():
            for period, bars in periods_data.items():
                if not bars:
                    continue

                logger.info(f"保存 {contract} {PERIODS.get(period, period+'s')} ({len(bars)} 根)...")

                # 批量插入，使用 INSERT IGNORE 避免重复
                batch_size = 500
                for i in range(0, len(bars), batch_size):
                    batch = bars[i:i + batch_size]
                    values = []
                    for bar in batch:
                        values.append((
                            bar['contract'],
                            bar['period'],
                            bar['datetime'],
                            bar.get('open'),
                            bar.get('high'),
                            bar.get('low'),
                            bar.get('close'),
                            bar.get('volume', 0),
                            bar.get('open_interest', 0),
                        ))

                    try:
                        affected = cursor.executemany(
                            """
                            INSERT IGNORE INTO kline_cache
                              (contract, period, datetime, open, high, low, close, volume, openInterest)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            values
                        )
                        total_inserted += cursor.rowcount
                    except Exception as e:
                        logger.error(f"批量插入失败: {e}")
                        conn.rollback()
                        continue

                conn.commit()

        cursor.close()
        conn.close()

        logger.info(f"\n数据库保存完成: 插入 {total_inserted} 条记录")

    except ImportError:
        logger.warning("pymysql 未安装，将数据输出为 JSON 格式")
        logger.warning("安装方式: pip install pymysql")
        output_json(all_results)
    except Exception as e:
        logger.error(f"数据库操作失败: {e}")
        output_json(all_results)


def output_json(all_results: dict):
    """将结果输出为 JSON 文件"""
    output_file = '/tmp/tq_history_data.json'

    # 统计信息
    summary = {}
    for contract, periods_data in all_results.items():
        summary[contract] = {}
        for period, bars in periods_data.items():
            if bars:
                summary[contract][PERIODS.get(period, f'{period}s')] = {
                    'count': len(bars),
                    'from': bars[0]['datetime_str'] if bars else None,
                    'to': bars[-1]['datetime_str'] if bars else None,
                }

    output = {
        'downloaded_at': datetime.now().isoformat(),
        'summary': summary,
        'data': all_results,
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2, default=str)

    logger.info(f"数据已保存到: {output_file}")
    print(json.dumps({'type': 'history_saved', 'file': output_file, 'summary': summary}))


def emit_to_nodejs(all_results: dict):
    """通过 stdout 将数据推送给 Node.js 父进程"""
    total_bars = 0
    for contract, periods_data in all_results.items():
        for period, bars in periods_data.items():
            if bars:
                # 分批推送，每批 500 根
                batch_size = 500
                for i in range(0, len(bars), batch_size):
                    batch = bars[i:i + batch_size]
                    msg = {
                        'type': 'history_klines',
                        'contract': contract,
                        'period': period,
                        'period_name': PERIODS.get(period, f'{period}s'),
                        'batch_index': i // batch_size,
                        'total_bars': len(bars),
                        'data': batch,
                    }
                    print(json.dumps(msg, ensure_ascii=False), flush=True)
                    total_bars += len(batch)

    # 发送完成信号
    summary = {}
    for contract, periods_data in all_results.items():
        summary[contract] = {}
        for period, bars in periods_data.items():
            summary[contract][PERIODS.get(period, f'{period}s')] = len(bars)

    print(json.dumps({
        'type': 'history_complete',
        'total_bars': total_bars,
        'summary': summary,
    }, ensure_ascii=False), flush=True)


def print_summary(all_results: dict):
    """打印下载摘要"""
    print("\n" + "="*60, file=sys.stderr)
    print("历史数据下载摘要", file=sys.stderr)
    print("="*60, file=sys.stderr)

    total = 0
    for contract in CONTRACTS:
        periods_data = all_results.get(contract, {})
        print(f"\n{contract}:", file=sys.stderr)
        for period, bars in periods_data.items():
            period_name = PERIODS.get(period, f'{period}s')
            count = len(bars)
            total += count
            if count > 0:
                date_from = bars[0]['datetime_str']
                date_to = bars[-1]['datetime_str']
                print(f"  {period_name:12s}: {count:5d} 根  [{date_from} ~ {date_to}]", file=sys.stderr)
            else:
                print(f"  {period_name:12s}: 无数据", file=sys.stderr)

    print(f"\n合计: {total} 根 K 线", file=sys.stderr)
    print("="*60, file=sys.stderr)


def main():
    """主程序"""
    global TQ_USERNAME, TQ_PASSWORD, CONTRACTS  # noqa: PLW0603
    
    import argparse

    parser = argparse.ArgumentParser(description='天勤历史 K 线数据下载工具')
    parser.add_argument(
        '--periods', '-p',
        nargs='+',
        type=int,
        choices=list(PERIODS.keys()),
        default=[86400, 3600, 900],
        help='要下载的 K 线周期（秒），默认: 86400 3600 900'
    )
    parser.add_argument(
        '--contracts', '-c',
        nargs='+',
        default=CONTRACTS,
        help='要下载的合约列表'
    )
    parser.add_argument(
        '--mode', '-m',
        choices=['json', 'nodejs', 'db'],
        default='nodejs',
        help='输出模式: json=保存文件, nodejs=推送给父进程, db=写入数据库'
    )
    parser.add_argument(
        '--username', '-u',
        default=TQ_USERNAME,
        help='天勤快期账号'
    )
    parser.add_argument(
        '--password', '-pw',
        default=TQ_PASSWORD,
        help='天勤快期密码'
    )

    args = parser.parse_args()

    # 更新全局配置
    TQ_USERNAME = args.username
    TQ_PASSWORD = args.password
    CONTRACTS = args.contracts

    logger.info(f"天勤历史数据下载工具启动")
    logger.info(f"合约: {CONTRACTS}")
    logger.info(f"周期: {[PERIODS[p] for p in args.periods]}")
    logger.info(f"输出模式: {args.mode}")

    # 下载数据
    all_results = download_with_tqsdk(periods_to_download=args.periods)

    # 打印摘要
    print_summary(all_results)

    # 输出数据
    if args.mode == 'json':
        output_json(all_results)
    elif args.mode == 'nodejs':
        emit_to_nodejs(all_results)
    elif args.mode == 'db':
        save_to_database(all_results)


if __name__ == '__main__':
    main()
