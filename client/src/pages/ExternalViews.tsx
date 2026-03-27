// @ts-nocheck
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink } from "lucide-react";

export default function ExternalViews() {
  const { data: views } = trpc.externalViews.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "bullish":
        return "bg-green-500/10 text-green-600";
      case "bearish":
        return "bg-red-500/10 text-red-600";
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
            <h1 className="text-2xl font-bold">外部观点</h1>
            <p className="text-sm text-muted-foreground">
              汇总分析师观点和市场共识
            </p>
          </div>
          <Button className="button-primary">
            <Plus className="w-4 h-4 mr-2" />
            添加观点
          </Button>
        </div>
      </div>

      <div className="container py-8">
        {/* Views Grid */}
        <div className="space-y-4">
          {!views || views.length === 0 ? (
            <Card className="card-elegant">
              <div className="h-32 flex flex-col items-center justify-center">
                <p className="text-muted-foreground mb-4">暂无观点数据</p>
                <Button className="button-primary">添加第一个观点</Button>
              </div>
            </Card>
          ) : (
            views.map((view) => (
              <div key={view.id} className="card-elegant">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{view.title}</h3>
                      <Badge className={getSentimentColor(view.sentiment || "neutral")}>
                        {view.sentiment === 'bullish' ? '看涨' : view.sentiment === 'bearish' ? '看跌' : '中性'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {view.sourceName}
                      {view.author && ` • ${view.author}`}
                    </p>
                  </div>
                  {view.url && (
                    <a href={view.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>

                <p className="text-sm text-foreground mb-4">{view.summary}</p>

                {view.relatedContracts && (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-sm font-semibold mb-2">相关合约</p>
                    <div className="flex flex-wrap gap-2">
                      {(view.relatedContracts as string[]).map((contract) => (
                        <Badge key={contract} variant="secondary">
                          {contract}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
