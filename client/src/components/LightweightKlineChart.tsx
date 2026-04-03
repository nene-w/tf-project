import { useEffect, useRef } from "react";
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

interface LightweightKlineChartProps {
  data: KlineBar[];
  title?: string;
  height?: number;
  theme?: "light" | "dark";
  showVolume?: boolean;
}

/**
 * Lightweight Charts v5 K 线图表组件
 * 支持实时数据更新、缩放、平移等交互
 */
export function LightweightKlineChart({
  data,
  title = "K线图表",
  height = 500,
  theme = "dark",
  showVolume = true,
}: LightweightKlineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

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
      },
      width: containerRef.current.clientWidth,
      height: height,
      grid: {
        vertLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
        horzLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
      },
      crosshair: {
        mode: 1,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: false,
        borderColor: isDark ? "#374151" : "#d1d5db",
      },
      rightPriceScale: {
        borderColor: isDark ? "#374151" : "#d1d5db",
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
  }, [height, theme, showVolume]);

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

    // 转换数据格式：datetime 是毫秒，lightweight-charts 需要秒
    const candleData: CandlestickData<Time>[] = bars.map((bar) => ({
      time: Math.floor(bar.datetime / 1000) as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candleSeriesRef.current.setData(candleData);

    if (volumeSeriesRef.current) {
      const volumeData: HistogramData<Time>[] = bars.map((bar) => ({
        time: Math.floor(bar.datetime / 1000) as Time,
        value: bar.volume,
        color: bar.close >= bar.open ? "#22c55e55" : "#ef444455",
      }));

      volumeSeriesRef.current.setData(volumeData);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-4">
        <div
          ref={containerRef}
          style={{ width: "100%", height: `${height}px` }}
          className="rounded-lg overflow-hidden"
        />
        {data.length === 0 && (
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
