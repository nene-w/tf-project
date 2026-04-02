import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Sparkles, Loader2, FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ExternalViews() {
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [inputTitle, setInputTitle] = useState("");
  const [inputContent, setInputContent] = useState("");
  const [inputAuthor, setInputAuthor] = useState("");
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  const { data: views, refetch, isLoading: isListLoading } = trpc.externalViews.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const { data: weeklyReports } = trpc.viewConclusions.weeklyReports.useQuery({ limit: 5 });

  const submitTextMutation = trpc.externalViews.submitText.useMutation({
    onSuccess: (data: any) => {
      refetch();
      setIsTextModalOpen(false);
      setInputTitle("");
      setInputContent("");
      setInputAuthor("");
      const title = data?.data?.title || data?.title || inputTitle;
      toast.success(`成功提交文章：${title}`);
    },
    onError: (error: any) => {
      toast.error(`提交失败: ${error?.message || "未知错误"}`);
    }
  });

  const generateWeeklyReportMutation = trpc.externalViews.generateWeeklyFlameReport.useMutation({
    onSuccess: () => {
      toast.success("周度 FLAME 综合报告生成成功！");
    },
    onError: (error) => {
      toast.error(`生成失败: ${error.message}`);
    }
  });

  const getDimensionLabel = (dim: string) => {
    const labels: Record<string, string> = {
      F: "F-基本面",
      L: "L-流动性",
      A: "A-供需",
      M: "M-情绪",
      E: "E-外部环境"
    };
    return labels[dim] || dim;
  };

  const getScoreIcon = (score: number) => {
    if (score > 0) return <TrendingUp className="w-3 h-3 mr-1 text-green-600" />;
    if (score < 0) return <TrendingDown className="w-3 h-3 mr-1 text-red-600" />;
    return <Minus className="w-3 h-3 mr-1 text-yellow-600" />;
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTitle || !inputContent) {
      toast.error("标题和内容不能为空");
      return;
    }
    submitTextMutation.mutate({ 
      title: inputTitle, 
      content: inputContent,
      author: inputAuthor || "用户提交"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <div className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div>
            <h1 className="text-2xl font-bold">外部观点 (FLAME 框架)</h1>
            <p className="text-sm text-muted-foreground">
              基于 FLAME 框架识别预期差与市场共识
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              className="button-primary"
              onClick={() => setIsTextModalOpen(true)}
              disabled={submitTextMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              提交文章
            </Button>
            <Button 
              className="button-primary"
              onClick={() => generateWeeklyReportMutation.mutate()}
              disabled={generateWeeklyReportMutation.isPending}
              variant="outline"
            >
              <FileText className="w-4 h-4 mr-2" />
              {generateWeeklyReportMutation.isPending ? '报告生成中...' : '生成周度综合报告'}
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Text Input Modal */}
        {isTextModalOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl p-6 shadow-2xl border-accent/20 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">提交文章</h2>
              <p className="text-sm text-muted-foreground mb-6">
                复制粘贴微信公众号或其他来源的文章内容，系统将自动按 FLAME 框架进行分析。
              </p>
              <form onSubmit={handleTextSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">文章标题 *</label>
                  <input
                    type="text"
                    className="w-full p-2 rounded-md border border-input bg-background focus:ring-2 focus:ring-accent outline-none"
                    placeholder="输入文章标题"
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">作者（可选）</label>
                  <input
                    type="text"
                    className="w-full p-2 rounded-md border border-input bg-background focus:ring-2 focus:ring-accent outline-none"
                    placeholder="输入作者名称"
                    value={inputAuthor}
                    onChange={(e) => setInputAuthor(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">文章内容 *</label>
                  <textarea
                    className="w-full p-3 rounded-md border border-input bg-background focus:ring-2 focus:ring-accent outline-none min-h-[300px] resize-none"
                    placeholder="复制粘贴文章内容..."
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsTextModalOpen(false)}>取消</Button>
                  <Button type="submit" className="button-primary" disabled={submitTextMutation.isPending}>
                    {submitTextMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : '提交分析'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Weekly Reports Section (If any) */}
        {weeklyReports && weeklyReports.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-accent" />
              最新周度 FLAME 综合报告
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weeklyReports.map(report => (
                <Card key={report.id} className="p-4 border-accent/20 bg-accent/5 hover:bg-accent/10 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-accent">{report.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-accent text-accent">周报</Badge>
                  </div>
                  <p className="text-sm mt-3 line-clamp-2 text-muted-foreground italic">
                    "预期差：{report.keyExpectationGaps}"
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Views Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold mb-4">观点流</h2>
          {isListLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : !views || views.length === 0 ? (
            <Card className="card-elegant h-32 flex items-center justify-center text-muted-foreground">
              暂无观点数据，请先提交文章
            </Card>
          ) : (
            views.map((view) => (
              <div key={view.id} className="card-elegant p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{view.title}</h3>
                      <Badge className="bg-accent/10 text-accent border-none">
                        {getDimensionLabel(view.flameDimension || "F")}
                      </Badge>
                      <div className="flex items-center px-2 py-0.5 rounded bg-muted text-xs font-bold">
                        {getScoreIcon((view.sentimentScore || 0) as number)}
                        评分: {(view.sentimentScore || 0) > 0 ? `+${view.sentimentScore}` : view.sentimentScore}
                      </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">观点摘要</p>
                    <p className="text-sm text-foreground leading-relaxed line-clamp-4">{view.summary}</p>
                  </div>
                  <div className="bg-accent/5 p-3 rounded-lg border border-accent/10">
                    <p className="text-xs font-bold text-accent uppercase tracking-wider mb-2 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" />
                      核心预期差
                    </p>
                    <p className="text-sm text-foreground leading-relaxed italic">
                      {view.expectationGap || "未识别到明显预期差"}
                    </p>
                  </div>
                </div>

                {view.relatedContracts && Array.isArray(view.relatedContracts) && view.relatedContracts.length > 0 ? (
                  <div className="pt-4 mt-4 border-t border-border/50 flex flex-wrap gap-2">
                    {(view.relatedContracts as string[]).map((contract: string) => (
                      <Badge key={contract} variant="secondary" className="bg-muted text-muted-foreground border-none text-[10px]">
                        {contract}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
