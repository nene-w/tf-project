// @ts-nocheck
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Sparkles, Link as LinkIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ExternalViews() {
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState("");

  const { data: views, refetch, isLoading: isListLoading } = trpc.externalViews.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const fetchByUrlMutation = trpc.externalViews.fetchByUrl.useMutation({
    onSuccess: (data) => {
      refetch();
      setIsUrlModalOpen(false);
      setInputUrl("");
      toast.success(`成功抓取并分析文章：${data.data.title}`);
    },
    onError: (error) => {
      toast.error(`抓取失败: ${error.message}`);
    }
  });

  const scrapeHiborPuppeteerMutation = trpc.externalViews.scrapeHiborPuppeteer.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success(`成功抓取！共获取 ${data.totalReports} 篇研报`);
    },
    onError: (error) => {
      toast.error('抓取失败，请稍后重试');
    }
  });

  const autoAnalyzeMutation = trpc.viewConclusions.autoAnalyze.useMutation({
    onSuccess: (data) => {
      toast.success(`成功生成结论！`);
    },
    onError: (error) => {
      toast.error('AI 分析失败，请稍后重试');
    }
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

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl) return;
    fetchByUrlMutation.mutate({ url: inputUrl });
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
          <div className="flex gap-2">
            <Button 
              className="button-primary"
              onClick={() => setIsUrlModalOpen(true)}
              disabled={fetchByUrlMutation.isPending}
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              抓取网页文章
            </Button>
            <Button 
              className="button-primary"
              onClick={() => scrapeHiborPuppeteerMutation.mutate()}
              disabled={scrapeHiborPuppeteerMutation.isPending}
              variant="outline"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {scrapeHiborPuppeteerMutation.isPending ? '抓取中...' : '自动抓取研报'}
            </Button>
            <Button 
              className="button-primary"
              onClick={() => autoAnalyzeMutation.mutate()}
              disabled={autoAnalyzeMutation.isPending}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              {autoAnalyzeMutation.isPending ? '分析中...' : 'AI 自动分析'}
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* URL Input Modal (Simple implementation) */}
        {isUrlModalOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-6 shadow-2xl border-accent/20">
              <h2 className="text-xl font-bold mb-4">抓取网页文章</h2>
              <p className="text-sm text-muted-foreground mb-6">
                输入微信公众号或其他网页链接，系统将自动提取内容并进行 AI 分析。
              </p>
              <form onSubmit={handleUrlSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">文章链接</label>
                  <input
                    type="url"
                    className="w-full p-2 rounded-md border border-input bg-background focus:ring-2 focus:ring-accent outline-none"
                    placeholder="https://mp.weixin.qq.com/s/..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setIsUrlModalOpen(false)}
                    disabled={fetchByUrlMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button 
                    type="submit" 
                    className="button-primary"
                    disabled={fetchByUrlMutation.isPending}
                  >
                    {fetchByUrlMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        抓取分析中...
                      </>
                    ) : '开始抓取'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Views Grid */}
        <div className="space-y-4">
          {isListLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : !views || views.length === 0 ? (
            <Card className="card-elegant">
              <div className="h-32 flex flex-col items-center justify-center">
                <p className="text-muted-foreground mb-4">暂无观点数据</p>
                <Button className="button-primary" onClick={() => setIsUrlModalOpen(true)}>
                  添加第一个观点
                </Button>
              </div>
            </Card>
          ) : (
            views.map((view) => (
              <div key={view.id} className="card-elegant p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{view.title}</h3>
                      <Badge className={getSentimentColor(view.sentiment || "neutral")}>
                        {view.sentiment === 'bullish' ? '看涨' : view.sentiment === 'bearish' ? '看跌' : '中性'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      <span className="font-medium text-accent">{view.sourceName}</span>
                      {view.author && ` • ${view.author}`}
                      {view.createdAt && ` • ${new Date(view.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {view.url && (
                    <a href={view.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="rounded-full h-8 w-8 p-0">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>

                <p className="text-sm text-foreground leading-relaxed mb-4 line-clamp-3">{view.summary}</p>

                {view.relatedContracts && (
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex flex-wrap gap-2">
                      {(view.relatedContracts as string[]).map((contract) => (
                        <Badge key={contract} variant="secondary" className="bg-accent/5 text-accent-foreground border-none">
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
