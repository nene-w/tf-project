// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";

export default function TradeRecords() {
  const [showForm, setShowForm] = useState(false);
  const { data: trades } = trpc.tradeRecords.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const getDirectionIcon = (direction: string) => {
    return direction === "long" ? (
      <TrendingUp className="w-5 h-5 text-green-500" />
    ) : (
      <TrendingDown className="w-5 h-5 text-red-500" />
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500/10 text-blue-600";
      case "closed":
        return "bg-gray-500/10 text-gray-600";
      default:
        return "bg-yellow-500/10 text-yellow-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <div className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div>
            <h1 className="text-2xl font-bold">交易记录</h1>
            <p className="text-sm text-muted-foreground">
              监控和管理你的交易池位
            </p>
          </div>
          <Button className="button-primary" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-2" />
            新建交易
          </Button>
        </div>
      </div>

      <div className="container py-8">
        {/* Form */}
        {showForm && (
          <Card className="card-elegant mb-8">
            <h3 className="text-lg font-semibold mb-4">新建交易</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="合约代码 (如 T2406)"
                className="input-elegant"
              />
              <select className="input-elegant">
                <option>做多</option>
                <option>做空</option>
              </select>
              <input type="number" placeholder="开仓价格" className="input-elegant" />
              <input type="number" placeholder="数量" className="input-elegant" />
              <input type="datetime-local" className="input-elegant col-span-2" />
              <textarea
                placeholder="备注"
                className="input-elegant col-span-2"
                rows={3}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button className="button-primary">新建交易</Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                取消
              </Button>
            </div>
          </Card>
        )}

        {/* Trades List */}
        <div className="space-y-4">
          {!trades || trades.length === 0 ? (
            <Card className="card-elegant">
              <div className="h-32 flex flex-col items-center justify-center">
                <p className="text-muted-foreground mb-4">暂无交易记录</p>
                <Button className="button-primary" onClick={() => setShowForm(true)}>
                  新建第一个交易
                </Button>
              </div>
            </Card>
          ) : (
            trades.map((trade) => (
              <div key={trade.id} className="card-elegant">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-2.5 bg-accent/10 rounded-lg">
                      {getDirectionIcon(trade.direction)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{trade.contract}</h3>
                        <Badge className={trade.direction === "long" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}>
                          {trade.direction === 'long' ? '做多' : '做空'}
                        </Badge>
                        <Badge className={getStatusColor(trade.status)}>
                          {trade.status === 'open' ? '持仓' : '已平仓'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">开仓价格</p>
                          <p className="font-semibold">{trade.entryPrice}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">数量</p>
                          <p className="font-semibold">{trade.quantity}</p>
                        </div>
                        {trade.exitPrice && (
                          <div>
                            <p className="text-muted-foreground">平仓价格</p>
                            <p className="font-semibold">{trade.exitPrice}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground">开仓时间</p>
                          <p className="font-semibold">
                            {new Date(trade.entryTime).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    查看详情
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
