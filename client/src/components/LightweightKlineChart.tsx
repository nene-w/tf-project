import { useEffect, useRef, useState } from "react";
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
  datetime: number;
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
  period?: number; // 周期（秒），用于决定时间格式
}

/**
 * Lightweight Charts v5 K 线图表组件
 * 支持实时数据更新、缩放、平移等交互
 * 支持日期坐标轴和鼠标悬停 OHLC 提示
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

  // 根据周期决定时间格式
  const isIntraday = period < 86400;

  // 格式化时间戳为可读字符串
  function formatTime(unixSec: number): string {
    const d = new Date(unixSec * 1000);
    if (isIntraday) {
      // 分钟线显示日期+时间
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
      // 日线只显示日期
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }

  // 初始化图表
  useEffect(() => {
    if (!containerRef.current) return;

    // 清理旧图表
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    }

    const isDark = theme === "dark";

    // 创建新图表 (lightweight-charts v5 API)
    const chart = createChart(containerRef.current, {
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDark ? "#111827" : "#ffffff",
        },
        textColor: isDark ? "#d1d5db" : "#374151",
        fontSize: 12,
      },
      width: containerRef.current.clientWidth,
      height: height,
      grid: {
        vertLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
        horzLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? "#6b7280" : "#9ca3af",
          width: 1,
          style: 3, // dashed
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
        scaleMargins: {
          top: 0.05,
          bottom: showVolume ? 0.25 : 0.05,
        },
      },
      localization: {
        timeFormatter: (time: number) => formatTime(time),
        priceFormatter: (price: number) => price.toFixed(3),
      },
    });

    chartRef.current = chart;

    // 创建蜡烛图系列 (v5 新 API: chart.addSeries(CandlestickSeries, options))
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    candleSeriesRef.current = candleSeries;

    // 如果需要显示成交量
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "#6b7280",
        priceFormat: {
          type: "volume",
        },
        priceScaleId: "volume",
      });

      volumeSeriesRef.current = volumeSeries;

      // 设置成交量坐标轴
      chart.priceScale("volume").applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
    }

    // 设置数据
    if (data.length > 0) {
      setChartData(data);
      chart.timeScale().fitContent();
    }

    // 订阅十字光标移动事件，更新 OHLC 信息
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setOhlcInfo(null);
        return;
      }

      const candleData = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      const volumeData = volumeSeriesRef.current
        ? (param.seriesData.get(volumeSeriesRef.current) as HistogramData<Time> | undefined)
        : undefined;

      if (candleData && candleData.open !== undefined) {
        setOhlcInfo({
          time: formatTime(param.time as number),
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeData?.value,
          isUp: candleData.close >= candleData.open,
        });
      } else {
        setOhlcInfo(null);
      }
    });

    // 处理窗口大小变化
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
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
    setChartData(data);
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  function setChartData(bars: KlineBar[]) {
    if (!candleSeriesRef.current) return;

    // 转换数据格式：datetime 是纳秒，lightweight-charts 需要秒
    const candleData: CandlestickData<Time>[] = bars.map((bar) => ({
      time: Math.floor(bar.datetime / 1_000_000_000) as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candleSeriesRef.current.setData(candleData);

    if (volumeSeriesRef.current) {
      const volumeData: HistogramData<Time>[] = bars.map((bar) => ({
        time: Math.floor(bar.datetime / 1_000_000_000) as Time,
        value: bar.volume,
        color: bar.close >= bar.open ? "#22c55e55" : "#ef444455",
      }));

      volumeSeriesRef.current.setData(volumeData);
    }
  }

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
              <p className="text-lg font-medium">暂无数据</p>
              <p className="text-sm mt-1">请先在市场设置中启动数据服务</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
