import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const CONTRACT_LABELS: Record<string, string> = {
  "KQ.m@CFFEX.T": "T主连",
  "KQ.m@CFFEX.TF": "TF主连",
  "KQ.m@CFFEX.TS": "TS主连",
  "KQ.m@CFFEX.TL": "TL主连",
};

const SIGNAL_CONFIG = {
  buy: { label: "买入", icon: TrendingUp, color: "text-green-400", border: "border-green-500/40", bg: "bg-green-500/10" },
  sell: { label: "卖出", icon: TrendingDown, color: "text-red-400", border: "border-red-500/40", bg: "bg-red-500/10" },
  alert: { label: "报警", icon: AlertTriangle, color: "text-yellow-400", border: "border-yellow-500/40", bg: "bg-yellow-500/10" },
};

export default function SignalRecords() {
  const [filter, setFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");

  const { data: signals, refetch, isFetching } = trpc.signal.list.useQuery({ limit: 200 }, { refetchInterval: 10000 });
  const testSignalMutation = trpc.signal.testSignal.useMutation({
    onSuccess: (r) => {
      if (r.success) toast.success("测试信号发送成功，请检查邮箱");
      else toast.error("发送失败: " + r.error);
    },
  });

  const filtered = signals?.filter(s => {
    if (filter !== "all" && s.signalType !== filter) return false;
    if (contractFilter !== "all" && s.contract !== contractFilter) return false;
    return true;
  }) || [];

  const stats = {
    buy: signals?.filter(s => s.signalType === "buy").length || 0,
    sell: signals?.filter(s => s.signalType === "sell").length || 0,
    alert: signals?.filter(s => s.signalType === "alert").length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">信号记录</h1>
          <p className="text-sm text-muted-foreground mt-1">历史交易信号与报警记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-card border-border"
            onClick={() => testSignalMutation.mutate({ contract: "KQ.m@CFFEX.T", signalType: "buy" })}
            disabled={testSignalMutation.isPending}
          >
            <Bell className="h-3.5 w-3.5" />
            发送测试信号
          </Button>
          <Button variant="outline" size="icon" className="bg-card border-border" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(["buy", "sell", "alert"] as const).map(type => {
          const cfg = SIGNAL_CONFIG[type];
          const Icon = cfg.icon;
          return (
            <Card key={type} className={`bg-card border-border cursor-pointer hover:border-primary/30 transition-colors ${filter === type ? "border-primary/50" : ""}`} onClick={() => setFilter(filter === type ? "all" : type)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bg}`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{cfg.label}信号</p>
                    <p className="text-xl font-bold">{stats[type]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-32 bg-card border-border">
            <SelectValue placeholder="信号类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="buy">买入</SelectItem>
            <SelectItem value="sell">卖出</SelectItem>
            <SelectItem value="alert">报警</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-36 bg-card border-border">
            <SelectValue placeholder="合约筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部合约</SelectItem>
            {Object.entries(CONTRACT_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">共 {filtered.length} 条记录</span>
      </div>

      {/* Signal List */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {filtered.length > 0 ? (
            <div className="divide-y divide-border">
              {filtered.map(signal => {
                const cfg = SIGNAL_CONFIG[signal.signalType as keyof typeof SIGNAL_CONFIG] || SIGNAL_CONFIG.alert;
                const Icon = cfg.icon;
                return (
                  <div key={signal.id} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors">
                    <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{signal.indicatorName}</span>
                        <Badge variant="outline" className={`text-xs ${cfg.border} ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                          {CONTRACT_LABELS[signal.contract] || signal.contract}
                        </Badge>
                      </div>
                      {signal.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{signal.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {signal.price && (
                        <p className="text-sm font-mono font-medium">{Number(signal.price).toFixed(3)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(signal.triggeredAt).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">暂无信号记录</p>
              <p className="text-xs mt-1">当指标检测到交易信号时，记录将显示在这里</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
