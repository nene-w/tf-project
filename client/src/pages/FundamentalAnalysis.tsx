// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, BarChart3, TrendingUp, Activity, Globe, HeartPulse } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function FundamentalAnalysis() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: analyses, refetch: refetchAnalyses } = trpc.fundamentalAnalysis.list.useQuery({
    limit: 20,
    offset: 0,
  });

  const { data: fundamentalData, refetch: refetchData } = trpc.fundamentalData.list.useQuery({
    limit: 15,
  });

  const refreshDataMutation = trpc.fundamentalData.refresh.useMutation({
    onSuccess: (result) => {
      setIsRefreshing(false);
      if (result.success) {
        refetchData();
        toast.success(`成功刷新数据: ${result.message}`);
      } else {
        toast.error(result.message);
      }
    },
    onError: (err) => {
      setIsRefreshing(false);
      toast.error("数据刷新失败: " + err.message);
    }
  });

  const generateFlameMutation = trpc.fundamentalAnalysis.generateFlame.useMutation({
    onSuccess: () => {
      setIsGenerating(false);
      refetchAnalyses();
      refetchData();
      toast.success("FLAME 框架分析生成成功");
    },
    onError: (err) => {
      setIsGenerating(false);
      toast.error("生成失败: " + err.message);
    }
  });

  const handleGenerateFlame = async () => {
    setIsGenerating(true);
    await generateFlameMutation.mutateAsync({
      title: `国债市场 FLAME 深度分析 (${new Date().toLocaleDateString()})`,
      autoFetch: true,
    });
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await refreshDataMutation.mutateAsync();
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "strong_buy": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "buy": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "hold": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "sell": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "strong_sell": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'macro': return <BarChart3 className="w-4 h-4" />;
      case 'liquidity': return <Activity className="w-4 h-4" />;
      case 'bond_market': return <TrendingUp className="w-4 h-4" />;
      case 'sentiment': return <HeartPulse className="w-4 h-4" />;
      case 'external': return <Globe className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getDataTypeLabel = (type: string) => {
    switch (type) {
      case 'macro': return 'F: 基本面';
      case 'liquidity': return 'L: 流动性';
      case 'bond_market': return 'A: 债券供需';
      case 'sentiment': return 'M: 市场情绪';
      case 'external': return 'E: 外部环境';
      default: return '其他指标';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <div className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40 bg-background/80">
        <div className="container flex items-center justify-between h-16">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">基本面分析</h1>
            <p className="text-sm text-muted-foreground">
              基于 AKShare 与 FLAME 框架的专业机构级国债市场洞察
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              disabled={isRefreshing}
              className="hidden sm:flex"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? "刷新中..." : "刷新数据"}
            </Button>
            <Button
              className="button-primary"
              onClick={handleGenerateFlame}
              disabled={isGenerating}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isGenerating ? "正在分析中..." : "FLAME 自动化分析"}
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Data Overview (F, L, A, M, E) */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              FLAME 核心指标
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {fundamentalData?.map((data) => (
                <Card key={data.id} className="p-4 card-elegant hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary/80">
                      {getDataTypeIcon(data.dataType)}
                      {getDataTypeLabel(data.dataType)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(data.releaseDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">{data.indicator}</p>
                      <p className="text-xl font-bold tracking-tight">{data.value}<span className="text-xs font-normal ml-0.5">{data.unit}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Source</p>
                      <p className="text-[10px] font-semibold">{data.source}</p>
                    </div>
                  </div>
                </Card>
              ))}
              {(!fundamentalData || fundamentalData.length === 0) && (
                <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
                  暂无指标数据
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Analysis Reports */}
          <div className="lg:col-span-3 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              FLAME 深度分析报告
            </h2>
            <div className="space-y-6">
              {!analyses || analyses.length === 0 ? (
                <Card className="card-elegant p-12 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <Activity className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">开启专业分析</h3>
                    <p className="text-muted-foreground max-w-sm mb-6">
                      系统将利用 AKShare 抓取 F、L、A、M、E 五维实时数据，并由 AI 自动化生成深度报告。
                    </p>
                    <Button onClick={handleGenerateFlame} disabled={isGenerating}>
                      立即生成首份报告
                    </Button>
                  </div>
                </Card>
              ) : (
                analyses.map((analysis) => (
                  <Card key={analysis.id} className="card-elegant p-6 overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-xl font-bold mb-1 tracking-tight">{analysis.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{new Date(analysis.createdAt).toLocaleString()}</span>
                          <span>•</span>
                          <span>有效期至: {new Date(analysis.validUntil).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${getRecommendationColor(analysis.recommendation)} px-3 py-1 text-sm font-bold`}>
                          {analysis.recommendation === 'strong_buy' ? '强烈看多' : 
                           analysis.recommendation === 'buy' ? '看多' : 
                           analysis.recommendation === 'hold' ? '中性' : 
                           analysis.recommendation === 'sell' ? '看空' : '强烈看空'}
                        </Badge>
                        <Badge variant="secondary" className="px-3 py-1">
                          {analysis.riskLevel === 'high' ? '高风险' : analysis.riskLevel === 'medium' ? '中风险' : '低风险'}
                        </Badge>
                      </div>
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none bg-accent/5 p-6 rounded-xl border border-border/50 leading-relaxed">
                      <Streamdown>{analysis.content as any}</Streamdown>
                    </div>

                    {analysis.keyIndicators && (
                      <div className="mt-6 pt-6 border-t border-border/50">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">关联核心指标</p>
                        <div className="flex flex-wrap gap-2">
                          {(analysis.keyIndicators as string[]).map((indicator) => (
                            <Badge key={indicator} variant="outline" className="bg-background text-[10px] font-medium">
                              {indicator}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
