import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Settings,
  BarChart2,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// 合约信息
const CONTRACTS = [
  { code: "TF" as const, name: "5年期国债期货", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { code: "T" as const, name: "10年期国债期货", color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { code: "TL" as const, name: "30年期国债期货", color: "text-orange-500", bgColor: "bg-orange-500/10" },
];

// 趋势标签
const TREND_LABELS = {
  bullish: { label: "看多", icon: TrendingUp, color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/30" },
  bearish: { label: "看空", icon: TrendingDown, color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/30" },
  neutral: { label: "中性", icon: Minus, color: "text-yellow-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/30" },
};

// FLAME 维度标签
const FLAME_LABELS: Record<string, string> = {
  F: "基本面",
  L: "流动性",
  A: "供需结构",
  M: "市场情绪",
  E: "外部环境",
};

// Markdown 简单渲染（将 Markdown 转为 HTML）
function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3 border-b pb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\| (.+) \|$/gm, (match: string) => {
      const cells = match.split("|").filter(c => c.trim());
      return `<tr>${cells.map(c => `<td class="border border-border px-3 py-1.5 text-sm">${c.trim()}</td>`).join("")}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>)/g, '<table class="w-full border-collapse my-3">$1</table>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="my-2 space-y-1">$1</ul>')
    .replace(/^(?!<[h|t|u|l])(.+)$/gm, '<p class="text-sm leading-relaxed my-1">$1</p>')
    .replace(/\n\n/g, '<br/>');

  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// 单个合约分析卡片
function ContractAnalysisCard({ contract }: { contract: typeof CONTRACTS[0] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: report, refetch } = trpc.aiAnalyst.getLatestReport.useQuery(
    { contract: contract.code },
    { retry: false }
  );

  const generateMutation = trpc.aiAnalyst.generate.useMutation({
    onSuccess: () => {
      toast.success(`${contract.name}分析报告已生成`);
      refetch();
      setIsGenerating(false);
    },
    onError: (err) => {
      toast.error(`生成失败：${err.message}`);
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate({ contract: contract.code });
  };

  const trendInfo = report ? TREND_LABELS[report.trendConclusion] : null;
  const TrendIcon = trendInfo?.icon || Minus;
  const flameScores = (report?.flameScores as Record<string, number>) || {};

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${contract.bgColor}`}>
              <BarChart2 className={`w-5 h-5 ${contract.color}`} />
            </div>
            <div>
              <CardTitle className="text-base">{contract.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{contract.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report && trendInfo && (
              <Badge
                variant="outline"
                className={`${trendInfo.bgColor} ${trendInfo.color} ${trendInfo.borderColor} flex items-center gap-1`}
              >
                <TrendIcon className="w-3 h-3" />
                {trendInfo.label}
                <span className="ml-1 text-xs opacity-70">{report.confidenceScore}%</span>
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "分析中..." : "生成分析"}
            </Button>
          </div>
        </div>
      </CardHeader>

      {report && (
        <CardContent className="pt-0">
          {/* FLAME 评分条 */}
          {Object.keys(flameScores).length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium">FLAME 五维评分</p>
              <div className="grid grid-cols-5 gap-2">
                {["F", "L", "A", "M", "E"].map(dim => {
                  const score = flameScores[dim] ?? 0;
                  const isPositive = score > 0;
                  const isNegative = score < 0;
                  return (
                    <div key={dim} className="flex flex-col items-center gap-1">
                      <div className={`text-xs font-bold px-2 py-1 rounded text-center w-full ${
                        isPositive ? "bg-green-500/15 text-green-600" :
                        isNegative ? "bg-red-500/15 text-red-600" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {score > 0 ? "+" : ""}{score}
                      </div>
                      <span className="text-xs text-muted-foreground">{dim}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 关键价位 */}
          {((report.supportLevels as number[])?.length > 0 || (report.resistanceLevels as number[])?.length > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium mb-1">关键支撑位</p>
                {(report.supportLevels as number[])?.map((level, i) => (
                  <p key={i} className="text-sm font-mono font-semibold text-green-600">{level.toFixed(3)}</p>
                ))}
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <p className="text-xs text-red-600 font-medium mb-1">关键压力位</p>
                {(report.resistanceLevels as number[])?.map((level, i) => (
                  <p key={i} className="text-sm font-mono font-semibold text-red-600">{level.toFixed(3)}</p>
                ))}
              </div>
            </div>
          )}

          {/* 预期差摘要 */}
          {report.expectationGaps && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-accent mb-1">核心预期差</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{report.expectationGaps.slice(0, 200)}{report.expectationGaps.length > 200 ? "..." : ""}</p>
            </div>
          )}

          {/* 展开/收起完整报告 */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-muted-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <><ChevronUp className="w-3.5 h-3.5 mr-1" />收起完整报告</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5 mr-1" />查看完整报告</>
            )}
          </Button>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-border">
              <MarkdownContent content={report.content} />
            </div>
          )}

          {/* 报告时间 */}
          <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>生成于 {new Date(report.createdAt).toLocaleString("zh-CN")}</span>
          </div>
        </CardContent>
      )}

      {!report && !isGenerating && (
        <CardContent className="pt-0">
          <div className="text-center py-6 text-muted-foreground">
            <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">暂无分析报告</p>
            <p className="text-xs mt-1">点击"生成分析"开始 AI 综合分析</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// API 配置对话框
function ApiConfigDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    apiBaseUrl: "",
    apiKey: "",
    modelName: "gpt-4.1-mini",
    systemPrompt: "",
    temperature: 0.7,
    maxTokens: 4000,
    isEnabled: false,
  });

  const { data: config, refetch } = trpc.aiAnalyst.getConfig.useQuery(undefined, { retry: false });

  const saveMutation = trpc.aiAnalyst.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("API 配置已保存");
      refetch();
      setOpen(false);
    },
    onError: (err) => {
      toast.error(`保存失败：${err.message}`);
    },
  });

  const handleOpen = () => {
    if (config) {
      setForm({
        apiBaseUrl: config.apiBaseUrl || "",
        apiKey: "", // 不回显密钥
        modelName: config.modelName || "gpt-4.1-mini",
        systemPrompt: config.systemPrompt || "",
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 4000,
        isEnabled: config.isEnabled || false,
      });
    }
    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleOpen}>
          <Settings className="w-4 h-4 mr-2" />
          API 配置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI 分析师 API 配置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">启用自定义 API</p>
              <p className="text-xs text-muted-foreground">关闭时使用系统内置 API</p>
            </div>
            <Switch
              checked={form.isEnabled}
              onCheckedChange={(v) => setForm(f => ({ ...f, isEnabled: v }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">API Base URL</Label>
            <Input
              placeholder="https://api.openai.com/v1"
              value={form.apiBaseUrl}
              onChange={(e) => setForm(f => ({ ...f, apiBaseUrl: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">支持 OpenAI 兼容格式的任意 API 接口</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">API Key</Label>
            <Input
              type="password"
              placeholder={config?.apiKey ? "已配置（留空不修改）" : "sk-..."}
              value={form.apiKey}
              onChange={(e) => setForm(f => ({ ...f, apiKey: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">模型名称</Label>
            <Input
              placeholder="gpt-4.1-mini"
              value={form.modelName}
              onChange={(e) => setForm(f => ({ ...f, modelName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">温度 (0-1)</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={form.temperature}
                onChange={(e) => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">最大 Token 数</Label>
              <Input
                type="number"
                min="1000"
                max="16000"
                step="500"
                value={form.maxTokens}
                onChange={(e) => setForm(f => ({ ...f, maxTokens: parseInt(e.target.value) }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">自定义 System Prompt（可选）</Label>
            <Textarea
              placeholder="留空使用默认的国债期货分析师提示词..."
              value={form.systemPrompt}
              onChange={(e) => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
              rows={4}
              className="text-xs"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "保存中..." : "保存配置"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 历史报告列表
function HistoryReports() {
  const [selectedContract, setSelectedContract] = useState<string | undefined>();
  const { data: reports } = trpc.aiAnalyst.getReports.useQuery(
    { contract: selectedContract, limit: 20 },
    { retry: false }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={!selectedContract ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedContract(undefined)}
        >
          全部
        </Button>
        {CONTRACTS.map(c => (
          <Button
            key={c.code}
            variant={selectedContract === c.code ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedContract(c.code)}
          >
            {c.code}
          </Button>
        ))}
      </div>

      {reports && reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map(report => {
            const trendInfo = TREND_LABELS[report.trendConclusion];
            const TrendIcon = trendInfo.icon;
            const contractInfo = CONTRACTS.find(c => c.code === report.contract);
            return (
              <Card key={report.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-xs ${contractInfo?.color}`}>
                          {report.contract}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${trendInfo.bgColor} ${trendInfo.color} ${trendInfo.borderColor} flex items-center gap-1`}
                        >
                          <TrendIcon className="w-3 h-3" />
                          {trendInfo.label} {report.confidenceScore}%
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{report.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(report.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                  </div>
                  {report.expectationGaps && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {report.expectationGaps}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无历史报告</p>
        </div>
      )}
    </div>
  );
}

// 主页面
export default function AiAnalyst() {
  const { data: config } = trpc.aiAnalyst.getConfig.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl">
            <Brain className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI 分析师</h1>
            <p className="text-sm text-muted-foreground">整合 FLAME 基本面与技术形态，生成专业趋势研判</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {config.isEnabled ? (
                <><CheckCircle className="w-3.5 h-3.5 text-green-500" />使用自定义 API ({config.modelName})</>
              ) : (
                <><AlertCircle className="w-3.5 h-3.5 text-yellow-500" />使用系统内置 API</>
              )}
            </div>
          ) : null}
          <ApiConfigDialog />
        </div>
      </div>

      {/* 数据来源说明 */}
      <Card className="border-dashed border-border bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">分析数据来源</p>
              <p>AI 分析师将自动整合以下数据生成综合研判：</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {[
                  { label: "FLAME 基本面报告", desc: "最新基本面分析" },
                  { label: "周度 FLAME 报告", desc: "预期差综合分析" },
                  { label: "外部观点", desc: "公众号文章观点" },
                  { label: "K 线技术数据", desc: "均线与形态识别" },
                ].map(item => (
                  <div key={item.label} className="bg-background rounded p-2 border border-border/50">
                    <p className="font-medium text-foreground text-xs">{item.label}</p>
                    <p className="text-xs opacity-70">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主内容 Tabs */}
      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis">最新分析</TabsTrigger>
          <TabsTrigger value="history">历史报告</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="mt-4">
          <div className="space-y-4">
            {CONTRACTS.map(contract => (
              <ContractAnalysisCard key={contract.code} contract={contract} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}
