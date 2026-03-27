import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function EmailSignals() {
  const [filter, setFilter] = useState<"all" | "pending" | "executed">("all");
  const [isAutoFetching, setIsAutoFetching] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [nextFetchCountdown, setNextFetchCountdown] = useState(300);

  const { data: signals, isLoading, refetch } = trpc.emailSignals.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const fetchEmailsMutation = trpc.emailSignals.fetchFromEmail.useMutation({
    onSuccess: (result) => {
      setLastFetchTime(new Date());
      setNextFetchCountdown(300);
      if (result.newSignals > 0) {
        toast.success(`成功抓取 ${result.newSignals} 个新信号`);
      } else {
        toast.info("未发现新信号");
      }
      refetch();
    },
    onError: (error) => {
      toast.error(`抓取失败: ${error.message}`);
    },
  });

  // 自动抓取邮件（每 5 分钟）
  useEffect(() => {
    if (!isAutoFetching) return;

    // 立即执行一次
    fetchEmailsMutation.mutate();

    // 设置定时器，每 5 分钟执行一次
    const interval = setInterval(() => {
      fetchEmailsMutation.mutate();
    }, 5 * 60 * 1000); // 5 分钟

    return () => clearInterval(interval);
  }, [isAutoFetching]);

  // 倒计时显示
  useEffect(() => {
    if (!isAutoFetching || !lastFetchTime) return;

    const countdownInterval = setInterval(() => {
      const elapsed = Math.floor(
        (new Date().getTime() - lastFetchTime.getTime()) / 1000
      );
      const remaining = Math.max(0, 300 - elapsed);
      setNextFetchCountdown(remaining);
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [isAutoFetching, lastFetchTime]);

  const filteredSignals = signals?.filter((signal) => {
    if (filter === "all") return true;
    return signal.status === filter;
  }) || [];

  const getSignalIcon = (type: string) => {
    return type === "buy" ? (
      <TrendingUp className="w-5 h-5 text-green-500" />
    ) : (
      <TrendingDown className="w-5 h-5 text-red-500" />
    );
  };

  const getSignalColor = (type: string) => {
    switch (type) {
      case "buy":
        return "bg-green-500/10 text-green-600";
      case "sell":
        return "bg-red-500/10 text-red-600";
      case "hold":
        return "bg-yellow-500/10 text-yellow-600";
      default:
        return "bg-gray-500/10 text-gray-600";
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <div className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div>
            <h1 className="text-2xl font-bold">邮件交易信号</h1>
            <p className="text-sm text-muted-foreground">
              监控和分析来自邮件的交易信号
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
              <div
                className={`w-2 h-2 rounded-full ${
                  isAutoFetching ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span className="text-sm font-medium">
                {isAutoFetching
                  ? `自动更新中 (${formatCountdown(nextFetchCountdown)})`
                  : "自动更新已关闭"}
              </span>
            </div>
            <Button
              variant={isAutoFetching ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAutoFetching(!isAutoFetching)}
            >
              {isAutoFetching ? "关闭自动更新" : "启用自动更新"}
            </Button>
            <Button
              className="button-primary"
              onClick={() => fetchEmailsMutation.mutate()}
              disabled={fetchEmailsMutation.isPending}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${
                  fetchEmailsMutation.isPending ? "animate-spin" : ""
                }`}
              />
              立即抓取
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* 自动化状态卡片 */}
        {lastFetchTime && (
          <Card className="card-elegant mb-6 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  最后更新时间
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {lastFetchTime.toLocaleTimeString("zh-CN")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  下次更新
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {formatCountdown(nextFetchCountdown)} 后
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <div className="flex gap-2">
            {(["all", "pending", "executed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === f
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f === "all" ? "全部" : f === "pending" ? "待执行" : "已执行"}
              </button>
            ))}
          </div>
        </div>

        {/* Signals List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="card-elegant">
              <div className="h-20 flex items-center justify-center">
                <p className="text-muted-foreground">加载中...</p>
              </div>
            </Card>
          ) : filteredSignals.length === 0 ? (
            <Card className="card-elegant">
              <div className="h-32 flex flex-col items-center justify-center">
                <p className="text-muted-foreground mb-4">暂无交易信号</p>
                <Button className="button-primary">添加第一个信号</Button>
              </div>
            </Card>
          ) : (
            filteredSignals.map((signal) => (
              <Card key={signal.id} className="card-elegant">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-2.5 bg-accent/10 rounded-lg">
                      {getSignalIcon(signal.signalType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{signal.contract}</h3>
                        <Badge className={getSignalColor(signal.signalType)}>
                          {signal.signalType === "buy"
                            ? "买入"
                            : signal.signalType === "sell"
                              ? "卖出"
                              : "持仓"}
                        </Badge>
                        <Badge variant="outline">
                          {signal.status === "pending"
                            ? "待执行"
                            : signal.status === "executed"
                              ? "已执行"
                              : "未知"}
                        </Badge>
                      </div>
                      {signal.emailSubject && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {signal.emailSubject}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        {signal.price && (
                          <span>
                            价格: <span className="font-semibold">{signal.price}</span>
                          </span>
                        )}
                        <span>
                          置信度:{" "}
                          <span className="font-semibold">{signal.confidence}%</span>
                        </span>
                        <span className="text-muted-foreground">
                          {signal.signalTime
                            ? new Date(signal.signalTime).toLocaleDateString(
                                "zh-CN"
                              )
                            : "未知"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    查看详情
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
