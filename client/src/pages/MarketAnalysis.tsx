import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LightweightKlineChart } from "@/components/LightweightKlineChart";
import { useLocation } from "wouter";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { io, Socket } from "socket.io-client";

const CONTRACTS = [
  { value: "KQ.m@CFFEX.T", label: "T主连 (10年期)" },
  { value: "KQ.m@CFFEX.TF", label: "TF主连 (5年期)" },
  { value: "KQ.m@CFFEX.TS", label: "TS主连 (2年期)" },
  { value: "KQ.m@CFFEX.TL", label: "TL主连 (30年期)" },
];

const PERIODS = [
  { value: "60", label: "1分钟" },
  { value: "300", label: "5分钟" },
  { value: "900", label: "15分钟" },
  { value: "1800", label: "30分钟" },
  { value: "3600", label: "1小时" },
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
  const [location, setLocation] = useLocation();
  const [selectedContract, setSelectedContract] = useState<string>("KQ.m@CFFEX.T");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("60");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<QuoteData | null>(null);
  const [klines, setKlines] = useState<KlineBar[]>([]);

  // 从 URL 参数读取默认合约
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const contract = params.get("contract");
    if (contract && CONTRACTS.some((c) => c.value === contract)) {
      setSelectedContract(contract);
    }
  }, []);

  // 获取 K 线数据
  const { data: klinesData, isLoading: isLoadingKlines, refetch: refetchKlines } = trpc.tq.getKlines.useQuery(
    {
      contract: selectedContract,
      period: parseInt(selectedPeriod),
      limit: 200,
    },
    {
      refetchInterval: parseInt(selectedPeriod) * 1000 + 5000, // 周期 + 5 秒
    }
  );

  // 获取实时行情
  const { data: quotesData } = trpc.tq.getQuotes.useQuery(undefined, {
    refetchInterval: 3000,
  });

  // 获取服务状态
  const { data: serviceStatus } = trpc.tq.getServiceStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // 初始化 Socket.IO 连接
  useEffect(() => {
    let socket: Socket | null = null;

    try {
      socket = io({
        path: "/api/socket.io",
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socket.on("connect", () => {
        setSocketConnected(true);
        console.log("Socket.IO connected");
      });

      socket.on("disconnect", () => {
        setSocketConnected(false);
        console.log("Socket.IO disconnected");
      });

      // 监听实时行情更新
      socket.on("quotes", (data: QuoteData[]) => {
        const quote = data.find((q) => q.contract === selectedContract);
        if (quote) {
          setCurrentQuote(quote);
        }
      });

      // 监听 K 线更新
      socket.on("kline", (data: any) => {
        if (data.contract === selectedContract && data.period === parseInt(selectedPeriod)) {
          // 更新最后一根 K 线
          setKlines((prev) => {
            if (prev.length === 0) return prev;
            const newKlines = [...prev];
            if (data.bars && data.bars.length > 0) {
              const lastBar = data.bars[data.bars.length - 1];
              newKlines[newKlines.length - 1] = lastBar;
            }
            return newKlines;
          });
        }
      });

      socket.on("tq_error", (error: string) => {
        console.error("TQ Service Error:", error);
      });

      socket.on("tq_disconnected", (code: number) => {
        console.warn("TQ Service Disconnected:", code);
      });
    } catch (error) {
      console.error("Failed to connect Socket.IO:", error);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [selectedContract, selectedPeriod]);

  // 更新 K 线数据
  useEffect(() => {
    if (klinesData && Array.isArray(klinesData)) {
      setKlines(klinesData);
    }
  }, [klinesData]);

  // 从 quotesData 中提取当前合约的行情
  useEffect(() => {
    if (quotesData && Array.isArray(quotesData) && quotesData.length > 0) {
      const quote = quotesData.find((q: any) => q.contract === selectedContract);
      if (quote) {
        setCurrentQuote(quote);
      }
    }
  }, [quotesData, selectedContract]);

  // 计算关键指标
  const stats = useMemo(() => {
    if (!klines || klines.length === 0) {
      return {
        highest: 0,
        lowest: 0,
        ma5: 0,
        ma10: 0,
        ma20: 0,
      };
    }

    const closes = klines.map((k) => k.close);
    const highest = Math.max(...closes);
    const lowest = Math.min(...closes);

    const calculateMA = (period: number) => {
      if (closes.length < period) return 0;
      const sum = closes.slice(-period).reduce((a, b) => a + b, 0);
      return sum / period;
    };

    return {
      highest,
      lowest,
      ma5: calculateMA(5),
      ma10: calculateMA(10),
      ma20: calculateMA(20),
    };
  }, [klines]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchKlines();
    setIsRefreshing(false);
  };

  const contractLabel =
    CONTRACTS.find((c) => c.value === selectedContract)?.label || selectedContract;
  const periodLabel = PERIODS.find((p) => p.value === selectedPeriod)?.label || selectedPeriod;

  const isUp = currentQuote ? currentQuote.lastPrice >= (currentQuote.close || currentQuote.lastPrice) : false;

  return (
    <div className="space-y-6 p-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>K线图表</span>
            <div className="flex items-center gap-2">
              <Badge variant={socketConnected ? "default" : "secondary"}>
                {socketConnected ? "实时连接" : "轮询模式"}
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACTS.map((contract) => (
                    <SelectItem key={contract.value} value={contract.value}>
                      {contract.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 周期选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">周期</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
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

      {/* 行情摘要 */}
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
                <p className="text-xs text-muted-foreground">成交量</p>
                <p className="text-lg font-bold">{currentQuote.volume.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">持仓量</p>
                <p className="text-lg font-bold">{currentQuote.openInterest.toLocaleString()}</p>
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

      {/* K 线图表 */}
      <LightweightKlineChart
        data={klines}
        title={`${contractLabel} - ${periodLabel}K线图`}
        height={500}
        theme="dark"
        showVolume={true}
      />

      {/* 技术指标 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">技术指标</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">最高价</p>
              <p className="text-lg font-bold text-green-500">{stats.highest.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">最低价</p>
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
