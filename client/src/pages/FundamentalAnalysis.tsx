// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw, BarChart3, TrendingUp, Activity, Globe, HeartPulse, Search, ArrowUpDown, Filter, AlertCircle } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FundamentalAnalysis() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  // 强制初始化为空数组，确保没有旧数据残留
  const { data: analyses, refetch: refetchAnalyses } = trpc.fundamentalAnalysis.list.useQuery({
    limit: 50,
    offset: 0,
  }, { initialData: [] });

  const { data: fundamentalData, refetch: refetchData, isLoading } = trpc.fundamentalData.list.useQuery({
    limit: 500,
  }, { initialData: [] });

  // 调试信息：实时监控数据量
  useEffect(() => {
    console.log("[Debug] Current data count:", fundamentalData?.length);
  }, [fundamentalData]);

  const refreshDataMutation = trpc.fundamentalData.refresh.useMutation({
    onSuccess: (result) => {
      setIsRefreshing(false);
      refetchData();
      toast.success(`数据已同步: ${result.message}`);
    },
    onError: (err) => {
      setIsRefreshing(false);
      toast.error("同步失败: " + err.message);
    }
  });

  const generateFlameMutation = trpc.fundamentalAnalysis.generateFlame.useMutation({
    onSuccess: () => {
      setIsGenerating(false);
      refetchAnalyses();
      refetchData();
      toast.success("分析报告已更新");
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

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'macro': return <BarChart3 className="w-4 h-4" />;
      case 'liquidity': return <Activity className="w-4 h-4" />;
      case 'supply': return <TrendingUp className="w-4 h-4" />;
      case 'sentiment': return <HeartPulse className="w-4 h-4" />;
      case 'external': return <Globe className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getDataTypeLabel = (type: string) => {
    switch (type) {
      case 'macro': return 'F: 基本面';
      case 'liquidity': return 'L: 流动性';
      case 'supply': return 'A: 债券供需';
      case 'sentiment': return 'M: 市场情绪';
      case 'external': return 'E: 外部环境';
      default: return '其他指标';
    }
  };

  const filteredData = useMemo(() => {
    if (!fundamentalData) return [];
    
    // 强制类型转换，确保数据是数组
    const rawData = Array.isArray(fundamentalData) ? fundamentalData : [];
    let result = [...rawData];

    if (activeTab !== "all") {
      // 兼容前端分类映射
      const tabMap = {
        "macro": "macro",
        "liquidity": "liquidity",
        "bond_market": "supply",
        "supply": "supply",
        "sentiment": "sentiment",
        "external": "external"
      };
      const targetType = tabMap[activeTab] || activeTab;
      result = result.filter(item => item.dataType === targetType);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.indicator.toLowerCase().includes(lowerSearch) || 
        (item.source && item.source.toLowerCase().includes(lowerSearch))
      );
    }

    result.sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      if (sortBy === "date-asc") return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
      if (sortBy === "name-asc") return a.indicator.localeCompare(b.indicator);
      return 0;
    });

    return result;
  }, [fundamentalData, activeTab, searchTerm, sortBy]);

  const sortedAnalyses = useMemo(() => {
    if (!analyses || !Array.isArray(analyses)) return [];
    return [...analyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [analyses]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* 强制置顶调试信息 */}
      <div className="bg-yellow-500/10 border-b border-yellow-500/20 py-2 px-4 flex items-center justify-center gap-4 text-xs font-mono text-yellow-700">
        <AlertCircle className="w-4 h-4" />
        <span>[调试信息] 数据库指标总数: <b className="text-red-600">{fundamentalData?.length || 0}</b></span>
        <span>|</span>
        <span>当前过滤后显示: <b className="text-blue-600">{filteredData.length}</b></span>
        <span>|</span>
        <span>最新同步时间: {new Date().toLocaleTimeString()}</span>
      </div>

      <div className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40 bg-background/80">
        <div className="container flex items-center justify-between h-16">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">基本面分析</h1>
            <p className="text-sm text-muted-foreground">
              仅展示本地推送的专业机构级国债市场洞察
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
              {isRefreshing ? "同步中..." : "同步本地数据"}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                FLAME 核心指标
              </h2>
              <Badge variant="secondary" className="font-mono">{filteredData.length} 指标</Badge>
            </div>

            <Card className="p-4 space-y-4 bg-background/50 backdrop-blur-sm border-primary/10">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索指标名称..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px]">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">日期 (新→旧)</SelectItem>
                    <SelectItem value="date-asc">日期 (旧→新)</SelectItem>
                    <SelectItem value="name-asc">名称 (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 h-auto p-1 bg-muted/50">
                  <TabsTrigger value="all" className="text-xs py-1.5">全部</TabsTrigger>
                  <TabsTrigger value="macro" className="text-xs py-1.5">F: 基本面</TabsTrigger>
                  <TabsTrigger value="liquidity" className="text-xs py-1.5">L: 流动性</TabsTrigger>
                  <TabsTrigger value="bond_market" className="text-xs py-1.5">A: 债券供需</TabsTrigger>
                  <TabsTrigger value="sentiment" className="text-xs py-1.5">M: 市场情绪</TabsTrigger>
                  <TabsTrigger value="external" className="text-xs py-1.5">E: 外部环境</TabsTrigger>
                </TabsList>
              </Tabs>
            </Card>

            <div className="grid grid-cols-1 gap-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-2 custom-scrollbar">
              {filteredData.map((data) => (
                <Card key={data.id} className="p-4 card-elegant hover:border-primary/30 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-primary/80 uppercase tracking-wider">
                      {getDataTypeIcon(data.dataType)}
                      {getDataTypeLabel(data.dataType)}
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {data.releaseDate ? new Date(data.releaseDate).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground font-medium mb-1 line-clamp-1" title={data.indicator}>
                        {data.indicator}
                      </p>
                      <div className="flex items-baseline gap-1">
                        {data.value !== null ? (
                          <>
                            <p className="text-lg font-bold tracking-tight">{data.value}</p>
                            <span className="text-xs font-normal text-muted-foreground">{data.unit}</span>
                          </>
                        ) : (
                          <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/20 font-normal text-[10px] py-0 px-1.5">
                            暂无数据
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Source</p>
                      <p className="text-[10px] font-semibold truncate max-w-[80px]">{data.source}</p>
                    </div>
                  </div>
                </Card>
              ))}
              {filteredData.length === 0 && !isLoading && (
                <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                  <Filter className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>未找到本地推送的指标数据</p>
                  <p className="text-xs mt-2">请确保已运行本地上传脚本</p>
                </div>
              )}
              {isLoading && (
                <div className="text-center py-20 text-muted-foreground">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-20" />
                  <p>正在加载数据...</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              FLAME 深度分析报告
            </h2>
            <div className="space-y-6">
              {sortedAnalyses.length === 0 ? (
                <Card className="card-elegant p-12 text-center bg-background/50 backdrop-blur-sm">
                  <div className="max-w-sm mx-auto space-y-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <BarChart3 className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">暂无分析报告</h3>
                    <p className="text-muted-foreground">
                      点击右上角的“FLAME 自动化分析”按钮，基于最新的本地指标生成深度市场洞察。
                    </p>
                    <Button onClick={handleGenerateFlame} disabled={isGenerating}>
                      {isGenerating ? "正在生成..." : "立即生成首份报告"}
                    </Button>
                  </div>
                </Card>
              ) : (
                sortedAnalyses.map((analysis) => (
                  <Card key={analysis.id} className="card-elegant overflow-hidden bg-background/50 backdrop-blur-sm">
                    <div className="p-6 border-b border-border/50 bg-muted/30">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">最新报告</Badge>
                          <h3 className="text-xl font-bold tracking-tight">{analysis.title}</h3>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className={getRecommendationColor(analysis.recommendation)}>
                            {analysis.recommendation === 'strong_buy' ? '看多' : 
                             analysis.recommendation === 'buy' ? '偏多' :
                             analysis.recommendation === 'hold' ? '中性' :
                             analysis.recommendation === 'sell' ? '偏空' : '看空'}
                          </Badge>
                          <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20">
                            {analysis.riskLevel === 'low' ? '低风险' : 
                             analysis.riskLevel === 'medium' ? '中风险' : '高风险'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {new Date(analysis.createdAt).toLocaleString()}
                        </span>
                        <span>•</span>
                        <span>有效期至: {new Date(new Date(analysis.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="p-8 prose prose-slate max-w-none dark:prose-invert prose-headings:font-bold prose-p:leading-relaxed">
                      <Streamdown content={analysis.content} />
                    </div>
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
