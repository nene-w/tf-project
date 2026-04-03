import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LightweightKlineChart } from "@/components/LightweightKlineChart";
import { useLocation } from "wouter";
import { RefreshCw, TrendingUp, TrendingDown, Wifi, WifiOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { io, Socket } from "socket.io-client";

const CONTRACTS = [
  { value: "KQ.m@CFFEX.T",  label: "T主连 (10年期)" },
  { value: "KQ.m@CFFEX.TF", label: "TF主连 (5年期)" },
  { value: "KQ.m@CFFEX.TS", label: "TS主连 (2年期)" },
  { value: "KQ.m@CFFEX.TL", label: "TL主连 (30年期)" },
];

const PERIODS = [
  { value: "60",    label: "1分钟" },
  { value: "300",   label: "5分钟" },
  { value: "900",   label: "15分钟" },
  { value: "1800",  label: "30分钟" },
  { value: "3600",  label: "1小时" },
  { value: "86400", label: "日线" },
];

interface QuoteData {
  contract: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume: number;
  openInterest: number;
  datetime: string;
  change: number;
  changePercent: number;
  open?: number;
  close?: number;
}

interface KlineBar {
  datetime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest?: number;
}

export default function KlineChartLwc() {
  const [, setLocation] = useLocation();
  const [selectedContract, setSelectedContract] = useState<string>("KQ.m@CFFEX.T");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("60");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<QuoteData | null>(null);
  const [klines, setKlines] = useState<KlineBar[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // 从 URL 参数读取默认合约
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const contract = params.get("contract");
    if (contract && CONTRACTS.some((c) => c.value === contract)) {
      setSelectedContract(contract);
    }
  }, []);

  // 根据周期动态调整 limit
  const klineLimit = useMemo(() => {
    const p = parseInt(selectedPeriod);
    if (p === 86400) return 180;
    if (p === 3600)  return 500;
    if (p === 900)   return 500;
    if (p === 300)   return 500;
    return 300;   // 1分钟
  }, [selectedPeriod]);

  // 从数据库加载历史 K 线
  const { data: klinesData, isLoading: isLoadingKlines, refetch: refetchKlines } =
    trpc.tq.getKlines.useQuery(
      { contract: selectedContract, period: parseInt(selectedPeriod), limit: klineLimit },
      { refetchOnWindowFocus: false }
    );

  // 获取实时行情（轮询兜底）
  const { data: quotesData } = trpc.tq.getQuotes.useQuery(undefined, {
    refetchInterval: 3000,
  });

  // 获取服务状态
  const { data: serviceStatus } = trpc.tq.getServiceStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // ── Socket.IO 实时推送 ──────────────────────────────────────────────────────
  useEffect(() => {
    let socket: Socket | null = null;

    try {
      socket = io({
        path: "/api/socket.io",
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
      });

      socket.on("connect", () => {
        setSocketConnected(true);
        console.log("[Socket.IO] connected:", socket?.id);
      });

      socket.on("disconnect", () => {
        setSocketConnected(false);
        console.log("[Socket.IO] disconnected");
      });

      // 实时行情推送
      socket.on("quotes", (data: QuoteData[]) => {
        const quote = data.find((q) => q.contract === selectedContract);
        if (quote) setCurrentQuote(quote);
      });

      // 批量历史 K 线推送（服务启动时）
      socket.on("klines", (payload: { contract: string; period: number; data: KlineBar[] }) => {
        if (
          payload.contract === selectedContract &&
          payload.period === parseInt(selectedPeriod) &&
          Array.isArray(payload.data) &&
          payload.data.length > 0
        ) {
          setKlines(payload.data);
        }
      });

      // 单根 K 线实时更新
      socket.on("kline", (payload: { contract: string; period: number; data: KlineBar; prev?: KlineBar }) => {
        if (
          payload.contract !== selectedContract ||
          payload.period !== parseInt(selectedPeriod)
        ) return;

        const bar = payload.data;
        if (!bar) return;

        // 直接调用图表的 updateBar 方法（lightweight-charts update API）
        const container = chartContainerRef.current;
        if (container && (container as any).__updateBar) {
          (container as any).__updateBar(bar);
        }

        // 同时更新 React state，保持数据一致
        setKlines((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          // 同一根 K 线（时间相同）→ 更新；否则追加
          if (last.datetime === bar.datetime) {
            const next = [...prev];
            next[next.length - 1] = bar;
            return next;
          } else {
            return [...prev, bar];
          }
        });
      });

      socket.on("tq_error", (error: string) => {
        console.error("[TQ] Error:", error);
      });

      socket.on("tq_disconnected", (code: number) => {
        console.warn("[TQ] Disconnected:", code);
      });
    } catch (error) {
      console.error("Failed to connect Socket.IO:", error);
    }

    return () => {
      socket?.disconnect();
    };
  }, [selectedContract, selectedPeriod]);

  // 历史 K 线数据加载完成后更新 state
  useEffect(() => {
    if (klinesData && Array.isArray(klinesData) && klinesData.length > 0) {
      setKlines(klinesData as KlineBar[]);
    }
  }, [klinesData]);

  // 从轮询行情中提取当前合约行情
  useEffect(() => {
    if (quotesData && Array.isArray(quotesData)) {
      const quote = (quotesData as QuoteData[]).find((q) => q.contract === selectedContract);
      if (quote) setCurrentQuote(quote);
    }
  }, [quotesData, selectedContract]);

  // 切换合约/周期时清空旧数据
  useEffect(() => {
    setKlines([]);
    setCurrentQuote(null);
  }, [selectedContract, selectedPeriod]);

  // 计算关键技术指标
  const stats = useMemo(() => {
    if (!klines || klines.length === 0) {
      return { highest: 0, lowest: 0, ma5: 0, ma10: 0, ma20: 0 };
    }
    const closes = klines.map((k) => k.close);
    const highest = Math.max(...closes);
    const lowest = Math.min(...closes);
    const calcMA = (n: number) => {
      if (closes.length < n) return 0;
      return closes.slice(-n).reduce((a, b) => a + b, 0) / n;
    };
    return { highest, lowest, ma5: calcMA(5), ma10: calcMA(10), ma20: calcMA(20) };
  }, [klines]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchKlines();
    setIsRefreshing(false);
  };

  const contractLabel = CONTRACTS.find((c) => c.value === selectedContract)?.label || selectedContract;
  const periodLabel   = PERIODS.find((p) => p.value === selectedPeriod)?.label || selectedPeriod;
  const isUp = currentQuote ? currentQuote.change >= 0 : false;

  return (
    <div className="space-y-6 p-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>K线图表</span>
            <div className="flex items-center gap-2">
              <Badge variant={socketConnected ? "default" : "secondary"} className="flex items-center gap-1">
                {socketConnected
                  ? <><Wifi className="w-3 h-3" /> 实时连接</>
                  : <><WifiOff className="w-3 h-3" /> 轮询模式</>}
              </Badge>
              <Badge variant={serviceStatus?.mode === "live" ? "default" : "secondary"}>
                {serviceStatus?.mode === "live" ? "实盘数据" : "模拟数据"}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 合约选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">合约</label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACTS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 周期选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">周期</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 刷新按钮 */}
            <div className="flex items-end">
              <Button
                onClick={handleRefresh}
                disabled={isLoadingKlines || isRefreshing}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {isRefreshing ? "刷新中..." : "刷新数据"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 实时行情摘要 */}
      {currentQuote && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{contractLabel} - 实时行情</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">最新价</p>
                <p className={`text-lg font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
                  {currentQuote.lastPrice.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">涨跌</p>
                <p className={`text-lg font-bold flex items-center gap-1 ${isUp ? "text-green-500" : "text-red-500"}`}>
                  {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {currentQuote.change.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">涨跌幅</p>
                <p className={`text-lg font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
                  {currentQuote.changePercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">买价</p>
                <p className="text-lg font-bold">{currentQuote.bidPrice.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">卖价</p>
                <p className="text-lg font-bold">{currentQuote.askPrice.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">时间</p>
                <p className="text-sm font-mono">
                  {new Date(currentQuote.datetime).toLocaleTimeString("zh-CN")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* K 线图表（传入 ref 以便实时更新） */}
      <div ref={chartContainerRef}>
        <LightweightKlineChart
          data={klines}
          title={`${contractLabel} - ${periodLabel}K线图`}
          height={520}
          theme="dark"
          showVolume={true}
          period={parseInt(selectedPeriod)}
        />
      </div>

      {/* 技术指标 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">技术指标</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">区间最高</p>
              <p className="text-lg font-bold text-green-500">{stats.highest.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">区间最低</p>
              <p className="text-lg font-bold text-red-500">{stats.lowest.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MA5</p>
              <p className="text-lg font-bold">{stats.ma5.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MA10</p>
              <p className="text-lg font-bold">{stats.ma10.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MA20</p>
              <p className="text-lg font-bold">{stats.ma20.toFixed(3)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
