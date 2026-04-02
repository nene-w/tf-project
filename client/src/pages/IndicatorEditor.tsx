import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Code2, Play, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

const CONTRACTS = [
  { value: "KQ.m@CFFEX.T", label: "T主连" },
  { value: "KQ.m@CFFEX.TF", label: "TF主连" },
  { value: "KQ.m@CFFEX.TS", label: "TS主连" },
  { value: "KQ.m@CFFEX.TL", label: "TL主连" },
];

const EXAMPLE_TDX = `{示例：MACD指标}
SHORT:=12;
LONG:=26;
MID:=9;
DIF:=EMA(CLOSE,SHORT)-EMA(CLOSE,LONG);
DEA:=EMA(DIF,MID);
MACD:=2*(DIF-DEA);
BUY:=CROSS(DIF,DEA);
SELL:=CROSS(DEA,DIF);`;

export default function IndicatorEditor() {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    tdxCode: "",
    appliedContracts: [] as string[],
  });
  const [previewCode, setPreviewCode] = useState("");
  const [previewResult, setPreviewResult] = useState<{ success: boolean; pythonCode: string; error?: string; outputVars: string[]; signalVars: string[] } | null>(null);

  const { data: indicators, refetch } = trpc.indicator.list.useQuery();
  const createMutation = trpc.indicator.create.useMutation({
    onSuccess: () => {
      toast.success("指标创建成功");
      setShowForm(false);
      setForm({ name: "", description: "", tdxCode: "", appliedContracts: [] });
      refetch();
    },
    onError: (e) => toast.error("创建失败: " + e.message),
  });
  const updateMutation = trpc.indicator.update.useMutation({
    onSuccess: () => { toast.success("已更新"); refetch(); },
    onError: (e) => toast.error("更新失败: " + e.message),
  });
  const deleteMutation = trpc.indicator.delete.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error("删除失败: " + e.message),
  });
  const convertMutation = trpc.indicator.convertPreview.useMutation({
    onSuccess: (result) => {
      setPreviewResult(result);
      if (result.success) {
        toast.success(`转换成功，识别到 ${result.outputVars.length} 个输出变量，${result.signalVars.length} 个信号变量`);
      } else {
        toast.error("转换失败: " + result.error);
      }
    },
  });

  const handleConvertPreview = () => {
    if (!previewCode.trim()) {
      toast.warning("请先输入通达信指标代码");
      return;
    }
    convertMutation.mutate({ tdxCode: previewCode, name: "PREVIEW" });
  };

  const handleCreate = () => {
    if (!form.name.trim() || !form.tdxCode.trim()) {
      toast.warning("请填写指标名称和代码");
      return;
    }
    createMutation.mutate(form);
  };

  const toggleContract = (contract: string) => {
    setForm(prev => ({
      ...prev,
      appliedContracts: prev.appliedContracts.includes(contract)
        ? prev.appliedContracts.filter(c => c !== contract)
        : [...prev.appliedContracts, contract],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">指标编辑</h1>
          <p className="text-sm text-muted-foreground mt-1">通达信指标代码转换为天勤量化Python格式</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          新建指标
        </Button>
      </div>

      {/* Converter Preview Tool */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            通达信代码转换预览
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">通达信指标代码（输入）</Label>
              <Textarea
                value={previewCode}
                onChange={e => setPreviewCode(e.target.value)}
                placeholder={EXAMPLE_TDX}
                className="font-mono text-xs bg-background border-border h-48 resize-none"
              />
              <Button
                onClick={handleConvertPreview}
                disabled={convertMutation.isPending}
                size="sm"
                className="gap-2"
              >
                <Play className="h-3.5 w-3.5" />
                {convertMutation.isPending ? "转换中..." : "立即转换"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Python/天勤量化代码（输出）
                {previewResult && (
                  <span className={`ml-2 ${previewResult.success ? "text-green-400" : "text-red-400"}`}>
                    {previewResult.success ? "✓ 转换成功" : "✗ 转换失败"}
                  </span>
                )}
              </Label>
              <div className="relative">
                <pre className="font-mono text-xs bg-background border border-border rounded-md p-3 h-48 overflow-auto text-muted-foreground">
                  {previewResult?.success
                    ? previewResult.pythonCode
                    : previewResult?.error
                      ? `# 错误：${previewResult.error}`
                      : "# 转换结果将显示在这里..."}
                </pre>
              </div>
              {previewResult?.success && (
                <div className="flex flex-wrap gap-1.5">
                  {previewResult.outputVars.map(v => (
                    <Badge key={v} variant="outline" className="text-xs border-blue-500/40 text-blue-400">📊 {v}</Badge>
                  ))}
                  {previewResult.signalVars.map(v => (
                    <Badge key={v} variant="outline" className="text-xs border-green-500/40 text-green-400">🔔 {v}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Form */}
      {showForm && (
        <Card className="bg-card border-primary/30 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">新建指标</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">指标名称 *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="如：MACD、KDJ、布林带"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">描述（可选）</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="指标用途说明"
                  className="bg-background border-border"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">通达信指标代码 *</Label>
              <Textarea
                value={form.tdxCode}
                onChange={e => setForm(p => ({ ...p, tdxCode: e.target.value }))}
                placeholder={EXAMPLE_TDX}
                className="font-mono text-xs bg-background border-border h-40 resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">应用合约</Label>
              <div className="flex flex-wrap gap-2">
                {CONTRACTS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => toggleContract(c.value)}
                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                      form.appliedContracts.includes(c.value)
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "保存中..." : "保存指标"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indicator List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">已保存指标</h2>
        {indicators && indicators.length > 0 ? (
          indicators.map(ind => (
            <Card key={ind.id} className="bg-card border-border">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${ind.isActive ? "bg-primary" : "bg-muted-foreground"}`} />
                    <div>
                      <span className="font-semibold text-sm">{ind.name}</span>
                      {ind.description && <span className="text-xs text-muted-foreground ml-2">{ind.description}</span>}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${ind.convertStatus === "success" ? "border-green-500/40 text-green-400" : ind.convertStatus === "error" ? "border-red-500/40 text-red-400" : "border-yellow-500/40 text-yellow-400"}`}
                    >
                      {ind.convertStatus === "success" ? <><CheckCircle className="h-3 w-3 mr-1" />已转换</> : ind.convertStatus === "error" ? <><XCircle className="h-3 w-3 mr-1" />转换失败</> : "待转换"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!ind.isActive}
                      onCheckedChange={(checked) => updateMutation.mutate({ id: ind.id, isActive: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setExpandedId(expandedId === ind.id ? null : ind.id)}
                    >
                      {expandedId === ind.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`确认删除指标"${ind.name}"？`)) {
                          deleteMutation.mutate({ id: ind.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expandedId === ind.id && (
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">通达信代码</Label>
                      <pre className="font-mono text-xs bg-background border border-border rounded-md p-3 h-36 overflow-auto text-foreground">
                        {ind.tdxCode}
                      </pre>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Python代码
                        {ind.convertStatus === "error" && ind.convertError && (
                          <span className="ml-2 text-red-400">{ind.convertError}</span>
                        )}
                      </Label>
                      <pre className="font-mono text-xs bg-background border border-border rounded-md p-3 h-36 overflow-auto text-muted-foreground">
                        {ind.pythonCode || "# 暂无转换结果"}
                      </pre>
                    </div>
                  </div>
                  {(ind.appliedContracts as string[])?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(ind.appliedContracts as string[]).map(c => (
                        <Badge key={c} variant="outline" className="text-xs">
                          {CONTRACTS.find(x => x.value === c)?.label || c}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Code2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">暂无指标，点击"新建指标"添加您的第一个通达信指标</p>
          </div>
        )}
      </div>
    </div>
  );
}
