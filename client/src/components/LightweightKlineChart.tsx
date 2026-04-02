import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi } from "lightweight-charts";
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
 * Lightweight Charts K 线图表组件
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
    if (!containerRef.current || !data.length) return;

    // 清理旧图表
    if (chartRef.current) {
      chartRef.current.remove();
    }

    // 创建新图表
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: theme === "dark" ? "#1a1a1a" : "#ffffff" },
        textColor: theme === "dark" ? "#d1d5db" : "#374151",
      },
      width: containerRef.current.clientWidth,
      height: height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
    });

    chartRef.current = chart;

    // 创建蜡烛图系列
    const candleSeries = (chart as any).addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    } as any);

    candleSeriesRef.current = candleSeries;

    // 转换数据格式
    const candleData = data.map((bar) => ({
      time: (bar.datetime / 1000) as any, // Lightweight Charts 使用秒为单位
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candleSeries.setData(candleData);

    // 如果需要显示成交量
    if (showVolume) {
      const volumeSeries = (chart as any).addHistogramSeries({
        color: "#6b7280",
        priceFormat: {
          type: "volume",
        },
      } as any);

      volumeSeriesRef.current = volumeSeries;

      const volumeData = data.map((bar) => ({
        time: (bar.datetime / 1000) as any,
        value: bar.volume,
        color: bar.close >= bar.open ? "#22c55e" : "#ef4444",
      }));

      volumeSeries.setData(volumeData);

      // 设置成交量在右侧坐标轴
      volumeSeries.priceScale().alignToContent();
    }

    // 自动缩放以适应所有数据
    chart.timeScale().fitContent();

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
      }
    };
  }, [data, height, theme, showVolume]);

  // 更新数据（用于实时更新）
  useEffect(() => {
    if (!candleSeriesRef.current || !data.length) return;

    const candleData = data.map((bar) => ({
      time: (bar.datetime / 1000) as any,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candleSeriesRef.current.setData(candleData);

    if (volumeSeriesRef.current) {
      const volumeData = data.map((bar) => ({
        time: (bar.datetime / 1000) as any,
        value: bar.volume,
        color: bar.close >= bar.open ? "#22c55e" : "#ef4444",
      }));

      volumeSeriesRef.current.setData(volumeData);
    }

    // 自动缩放
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          style={{ width: "100%", height: `${height}px` }}
          className="rounded-lg overflow-hidden"
        />
      </CardContent>
    </Card>
  );
}
