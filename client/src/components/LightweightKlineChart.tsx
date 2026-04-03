import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  CandlestickData,
  HistogramData,
  Time,
  CrosshairMode,
} from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface KlineBar {
  datetime: number;  // 纳秒时间戳（来自 TQSdk）
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest?: number;
}

interface OhlcInfo {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  isUp: boolean;
}

interface LightweightKlineChartProps {
  data: KlineBar[];
  title?: string;
  height?: number;
  theme?: "light" | "dark";
  showVolume?: boolean;
  period?: number;  // 周期（秒），用于决定时间格式
}

/**
 * Lightweight Charts v5 K 线图表组件
 * - 底部时间轴显示格式化日期
 * - 鼠标悬停显示 OHLC 数据
 * - 支持通过 updateBar() 实时更新最后一根 K 线（由父组件调用）
 */
export function LightweightKlineChart({
  data,
  title = "K线图表",
  height = 500,
  theme = "dark",
  showVolume = true,
  period = 86400,
}: LightweightKlineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [ohlcInfo, setOhlcInfo] = useState<OhlcInfo | null>(null);

  const isIntraday = period < 86400;

  // 纳秒时间戳 → Unix 秒（lightweight-charts 使用秒）
  function nsToSec(ns: number): number {
    // 如果已经是秒级（< 2e10），直接返回；否则按纳秒处理
    if (ns < 2e10) return Math.floor(ns);
    if (ns < 2e13) return Math.floor(ns / 1000);       // 毫秒
    if (ns < 2e16) return Math.floor(ns / 1_000_000);  // 微秒
    return Math.floor(ns / 1_000_000_000);              // 纳秒
  }

  // 纳秒时间戳 → lightweight-charts Time
  // 日线图要求 'YYYY-MM-DD' 字符串；分钟线使用 Unix 秒数字
  function nsToTime(ns: number): Time {
    const sec = nsToSec(ns);
    if (!isIntraday) {
      // 日线：转为 UTC 日期字符串 'YYYY-MM-DD'
      const d = new Date(sec * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      // 使用 UTC+8（中国时区）的日期
      const cst = new Date(sec * 1000 + 8 * 3600 * 1000);
      return `${cst.getUTCFullYear()}-${pad(cst.getUTCMonth() + 1)}-${pad(cst.getUTCDate())}` as unknown as Time;
    }
    return sec as Time;
  }

  function formatTime(unixSec: number): string {
    const d = new Date(unixSec * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    if (isIntraday) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    }

    const isDark = theme === "dark";

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#111827" : "#ffffff" },
        textColor: isDark ? "#d1d5db" : "#374151",
        fontSize: 12,
      },
      width: containerRef.current.clientWidth,
      height,
      grid: {
        vertLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
        horzLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? "#6b7280" : "#9ca3af",
          width: 1,
          style: 3,
          labelBackgroundColor: isDark ? "#374151" : "#f3f4f6",
        },
        horzLine: {
          color: isDark ? "#6b7280" : "#9ca3af",
          width: 1,
          style: 3,
          labelBackgroundColor: isDark ? "#374151" : "#f3f4f6",
        },
      },
      timeScale: {
        timeVisible: isIntraday,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: false,
        borderColor: isDark ? "#374151" : "#d1d5db",
        tickMarkFormatter: (time: number) => {
          const d = new Date(time * 1000);
          const pad = (n: number) => String(n).padStart(2, "0");
          if (isIntraday) {
            return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
          }
          return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
        },
      },
      rightPriceScale: {
        borderColor: isDark ? "#374151" : "#d1d5db",
        scaleMargins: { top: 0.05, bottom: showVolume ? 0.25 : 0.05 },
      },
      localization: {
        timeFormatter: (time: number) => formatTime(time),
        priceFormatter: (price: number) => price.toFixed(3),
      },
    });

    chartRef.current = chart;

    // 蜡烛图系列
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;

    // 成交量子图
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "#6b7280",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      volumeSeriesRef.current = volumeSeries;
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
    }

    // 设置初始数据
    if (data.length > 0) {
      applyData(data, chart, candleSeries, volumeSeriesRef.current);
      chart.timeScale().fitContent();
    }

    // 十字光标悬停事件 → 更新 OHLC 信息栏
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setOhlcInfo(null);
        return;
      }
      const cd = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      const vd = volumeSeriesRef.current
        ? (param.seriesData.get(volumeSeriesRef.current) as HistogramData<Time> | undefined)
        : undefined;
      if (cd && cd.open !== undefined) {
        setOhlcInfo({
          time: formatTime(param.time as number),
          open: cd.open,
          high: cd.high,
          low: cd.low,
          close: cd.close,
          volume: vd?.value,
          isUp: cd.close >= cd.open,
        });
      } else {
        setOhlcInfo(null);
      }
    });

    // 窗口大小变化
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, [height, theme, showVolume, isIntraday]);

  // 数据更新时重新设置
  useEffect(() => {
    if (!candleSeriesRef.current || data.length === 0) return;
    applyData(data, chartRef.current!, candleSeriesRef.current, volumeSeriesRef.current);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // 将 KlineBar[] 转换并写入图表
  function applyData(
    bars: KlineBar[],
    _chart: IChartApi,
    candleSeries: ISeriesApi<"Candlestick">,
    volumeSeries: ISeriesApi<"Histogram"> | null
  ) {
    const candleData: CandlestickData<Time>[] = bars.map((bar) => ({
      time: nsToTime(bar.datetime),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));
    candleSeries.setData(candleData);

    if (volumeSeries) {
      const volData: HistogramData<Time>[] = bars.map((bar) => ({
        time: nsToTime(bar.datetime),
        value: bar.volume,
        color: bar.close >= bar.open ? "#22c55e55" : "#ef444455",
      }));
      volumeSeries.setData(volData);
    }
  }

  /**
   * 实时更新最后一根 K 线（由父组件通过 ref 调用）
   * 如果 bar.datetime 与最后一根相同，则更新；否则追加新 K 线。
   */
  const updateBar = useCallback((bar: KlineBar) => {
    if (!candleSeriesRef.current) return;
    const t = nsToTime(bar.datetime);
    const cd: CandlestickData<Time> = {
      time: t,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    };
    candleSeriesRef.current.update(cd);

    if (volumeSeriesRef.current) {
      const vd: HistogramData<Time> = {
        time: t,
        value: bar.volume,
        color: bar.close >= bar.open ? "#22c55e55" : "#ef444455",
      };
      volumeSeriesRef.current.update(vd);
    }
  }, [isIntraday]);

  // 暴露 updateBar 给父组件
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).__updateBar = updateBar;
    }
  }, [updateBar]);

  const isDark = theme === "dark";
  const ohlcColor = ohlcInfo?.isUp ? "#22c55e" : "#ef4444";

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {/* OHLC 悬停信息栏 */}
          {ohlcInfo ? (
            <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
              <span className={isDark ? "text-gray-400" : "text-gray-500"}>{ohlcInfo.time}</span>
              <span>
                <span className={isDark ? "text-gray-500" : "text-gray-400"}>开 </span>
                <span style={{ color: ohlcColor }}>{ohlcInfo.open.toFixed(3)}</span>
              </span>
              <span>
                <span className={isDark ? "text-gray-500" : "text-gray-400"}>高 </span>
                <span style={{ color: ohlcColor }}>{ohlcInfo.high.toFixed(3)}</span>
              </span>
              <span>
                <span className={isDark ? "text-gray-500" : "text-gray-400"}>低 </span>
                <span style={{ color: ohlcColor }}>{ohlcInfo.low.toFixed(3)}</span>
              </span>
              <span>
                <span className={isDark ? "text-gray-500" : "text-gray-400"}>收 </span>
                <span style={{ color: ohlcColor }}>{ohlcInfo.close.toFixed(3)}</span>
              </span>
              {ohlcInfo.volume !== undefined && (
                <span>
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>量 </span>
                  <span className={isDark ? "text-gray-300" : "text-gray-600"}>
                    {ohlcInfo.volume >= 10000
                      ? `${(ohlcInfo.volume / 10000).toFixed(1)}万`
                      : ohlcInfo.volume.toLocaleString()}
                  </span>
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">移动光标查看 OHLC 数据</div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-4">
        {data.length > 0 ? (
          <div
            ref={containerRef}
            style={{ width: "100%", height: `${height}px` }}
            className="rounded-lg overflow-hidden"
          />
        ) : (
          <div
            style={{ height: `${height}px` }}
            className="flex items-center justify-center text-muted-foreground"
          >
            <div className="text-center">
              <p className="text-lg font-medium">正在加载数据...</p>
              <p className="text-sm mt-1">如需实时行情，请在左侧导航栈“市场设置”中启动天勤数据服务</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
