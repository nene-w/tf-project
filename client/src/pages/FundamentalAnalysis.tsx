import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, BarChart3, TrendingUp, Activity, Globe, HeartPulse, Search, ArrowUpDown, Filter } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FundamentalAnalysis() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  const { data: fundamentalData, refetch: refetchData } = trpc.fundamentalData.list.useQuery({
    limit: 200,
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

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await refreshDataMutation.mutateAsync();
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

  const filteredData = useMemo(() => {
    if (!fundamentalData) return [];
    
    let result = [...fundamentalData];

    if (activeTab !== "all") {
      result = result.filter(item => item.dataType === activeTab);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.indicator.toLowerCase().includes(lowerSearch) || 
        (item.source && item.source.toLowerCase().includes(lowerSearch))
      );
    }

    result.sort((a, b) => {
      if (sortBy === "date-desc") {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === "date-asc") {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateA - dateB;
      }
      if (sortBy === "name-asc") return a.indicator.localeCompare(b.indicator);
      return 0;
    });

    return result;
  }, [fundamentalData, activeTab, searchTerm, sortBy]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40 bg-background/80">
        <div className="container flex items-center justify-between h-16">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">基本面分析</h1>
            <p className="text-sm text-muted-foreground">
              基于 AKShare 实时数据的 FLAME 框架指标展示
            </p>
          </div>
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
        </div>
      </div>

      <div className="container py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              FLAME 核心指标
            </h2>
            <Badge variant="secondary" className="font-mono">{fundamentalData?.length || 0} 指标</Badge>
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
              <TabsList className="grid grid-cols-3 h-auto p-1 bg-muted/50 md:grid-cols-6">
                <TabsTrigger value="all" className="text-xs py-1.5">全部</TabsTrigger>
                <TabsTrigger value="macro" className="text-xs py-1.5">F: 基本面</TabsTrigger>
                <TabsTrigger value="liquidity" className="text-xs py-1.5">L: 流动性</TabsTrigger>
                <TabsTrigger value="bond_market" className="text-xs py-1.5">A: 债券供需</TabsTrigger>
                <TabsTrigger value="sentiment" className="text-xs py-1.5">M: 市场情绪</TabsTrigger>
                <TabsTrigger value="external" className="text-xs py-1.5">E: 外部环境</TabsTrigger>
              </TabsList>
            </Tabs>
          </Card>

          <div className="grid grid-cols-1 gap-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
            {filteredData.map((data) => (
              <Card key={`${data.dataType}-${data.indicator}`} className="p-4 card-elegant hover:border-primary/30 transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-primary/80 uppercase tracking-wider">
                    {getDataTypeIcon(data.dataType)}
                    {getDataTypeLabel(data.dataType)}
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {data.releaseDate ? new Date(data.releaseDate).toLocaleDateString() : '未知'}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium mb-1 line-clamp-1" title={data.indicator}>
                      {data.indicator}
                    </p>
                    <p className="text-lg font-bold tracking-tight">
                      {data.value}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{data.unit}</span>
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Source</p>
                    <p className="text-[10px] font-semibold truncate max-w-[80px]">{data.source}</p>
                  </div>
                </div>
              </Card>
            ))}
            {filteredData.length === 0 && (
              <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
                <Filter className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>未找到匹配的指标数据</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
