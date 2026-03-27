import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Play, Pause, RefreshCw, Clock } from "lucide-react";

export default function EmailAutomation() {
  const [isPolling, setIsPolling] = useState(false);
  const [interval, setInterval] = useState(1);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  const fetchMutation = trpc.emailAutomation.fetchNow.useMutation();
  const startPollingMutation = trpc.emailAutomation.startPolling.useMutation();

  const handleFetchNow = async () => {
    try {
      const result = await fetchMutation.mutateAsync();
      if (result.success) {
        setLastFetchTime(new Date());
      }
    } catch (error) {
      console.error("邮件抓取失败:", error);
    }
  };

  const handleStartPolling = async () => {
    try {
      const result = await startPollingMutation.mutateAsync({
        intervalMinutes: interval,
      });
      if (result.success) {
        setIsPolling(true);
      }
    } catch (error) {
      console.error("启动自动抓取失败:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* 头部 */}
      <div className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div>
            <h1 className="text-2xl font-bold">邮件自动化</h1>
            <p className="text-sm text-muted-foreground">
              配置和管理邮件自动抓取设置
            </p>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 手动抓取 */}
          <Card className="card-elegant lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-accent/10 rounded-lg">
                <RefreshCw className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-semibold">手动抓取</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              立即检查邮箱并抓取最新的交易信号
            </p>
            <Button
              className="button-primary w-full"
              onClick={handleFetchNow}
              disabled={fetchMutation.isPending}
            >
              {fetchMutation.isPending ? "抓取中..." : "立即抓取"}
            </Button>
            {lastFetchTime && (
              <p className="text-xs text-muted-foreground mt-3">
                最后抓取: {lastFetchTime.toLocaleString("zh-CN")}
              </p>
            )}
          </Card>

          {/* 自动抓取设置 */}
          <Card className="card-elegant lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-accent/10 rounded-lg">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-semibold">自动抓取设置</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  检查间隔（分钟）
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={interval}
                    onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input-elegant flex-1"
                    disabled={isPolling}
                  />
                  <span className="text-sm text-muted-foreground">分钟</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                {isPolling ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm">
                      自动抓取已启动，每 {interval} 分钟检查一次
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                    <span className="text-sm text-muted-foreground">
                      自动抓取已停止
                    </span>
                  </>
                )}
              </div>

              <Button
                className={isPolling ? "button-secondary w-full" : "button-primary w-full"}
                onClick={handleStartPolling}
                disabled={startPollingMutation.isPending}
              >
                {startPollingMutation.isPending ? (
                  "处理中..."
                ) : isPolling ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    停止自动抓取
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    启动自动抓取
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* 配置说明 */}
        <Card className="card-elegant mt-6">
          <h3 className="font-semibold mb-4">配置说明</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium mb-1">邮箱配置</p>
              <p className="text-muted-foreground">
                接收邮箱: nene_555@163.com
              </p>
              <p className="text-muted-foreground">
                发件人: 594409520@qq.com
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">邮件主题格式</p>
              <p className="text-muted-foreground font-mono text-xs bg-muted/50 p-2 rounded">
                品种 日期 操作_周期
              </p>
              <p className="text-muted-foreground mt-2">
                例如: "二债 2026-03-27 买入_15" 表示二债在2026年3月27日的15分钟周期买入信号
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">支持的品种</p>
              <div className="flex flex-wrap gap-2">
                {["二债", "五债", "十债", "30债"].map((variety) => (
                  <Badge key={variety} variant="secondary">
                    {variety}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="font-medium mb-1">支持的周期</p>
              <div className="flex flex-wrap gap-2">
                {["15分钟", "30分钟", "60分钟", "日线"].map((period) => (
                  <Badge key={period} variant="secondary">
                    {period}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="font-medium mb-1">支持的操作</p>
              <div className="flex flex-wrap gap-2">
                {["买入", "卖出"].map((action) => (
                  <Badge key={action} variant="secondary">
                    {action}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* 最近抓取的信号 */}
        <Card className="card-elegant mt-6">
          <h3 className="font-semibold mb-4">最近抓取的信号</h3>
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Mail className="w-12 h-12 mb-2 opacity-20" />
            <p>暂无抓取记录</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
