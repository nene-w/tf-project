import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings2, Mail, Database, Play, Square, CheckCircle, XCircle, Send } from "lucide-react";

const CONTRACTS = [
  { value: "KQ.m@CFFEX.T", label: "T主连", desc: "10年期国债期货" },
  { value: "KQ.m@CFFEX.TF", label: "TF主连", desc: "5年期国债期货" },
  { value: "KQ.m@CFFEX.TS", label: "TS主连", desc: "2年期国债期货" },
  { value: "KQ.m@CFFEX.TL", label: "TL主连", desc: "30年期国债期货" },
];

const PERIODS = [
  { value: 60, label: "1分钟" },
  { value: 300, label: "5分钟" },
  { value: 900, label: "15分钟" },
  { value: 1800, label: "30分钟" },
  { value: 3600, label: "1小时" },
  { value: 86400, label: "日线" },
];

export default function Settings() {
  const [tqForm, setTqForm] = useState({
    tqUsername: "",
    tqPassword: "",
    subscribedContracts: ["KQ.m@CFFEX.T", "KQ.m@CFFEX.TF", "KQ.m@CFFEX.TS", "KQ.m@CFFEX.TL"] as string[],
    klinePeriod: 60,
    isEnabled: true,
  });
  const [emailForm, setEmailForm] = useState({
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "",
    toEmails: [] as string[],
    isEnabled: false,
    cooldownMinutes: 30,
  });
  const [toEmailInput, setToEmailInput] = useState("");
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; error?: string } | null>(null);

  const { data: tqConfig } = trpc.tq.getConfig.useQuery();
  const { data: emailConfig } = trpc.email.getConfig.useQuery();
  const { data: serviceStatus, refetch: refetchStatus } = trpc.tq.getServiceStatus.useQuery(undefined, { refetchInterval: 3000 });

  useEffect(() => {
    if (tqConfig) {
      setTqForm(prev => ({
        ...prev,
        tqUsername: tqConfig.tqUsername || "",
        tqPassword: tqConfig.tqPassword === "••••••••" ? "" : tqConfig.tqPassword || "",
        subscribedContracts: (tqConfig.subscribedContracts as string[]) || prev.subscribedContracts,
        klinePeriod: tqConfig.klinePeriod || 60,
        isEnabled: tqConfig.isEnabled !== false,
      }));
    }
  }, [tqConfig]);

  useEffect(() => {
    if (emailConfig) {
      setEmailForm(prev => ({
        ...prev,
        smtpHost: emailConfig.smtpHost || "",
        smtpPort: emailConfig.smtpPort || 465,
        smtpSecure: emailConfig.smtpSecure !== false,
        smtpUser: emailConfig.smtpUser || "",
        smtpPassword: emailConfig.smtpPassword === "••••••••" ? "" : emailConfig.smtpPassword || "",
        fromEmail: emailConfig.fromEmail || "",
        toEmails: (emailConfig.toEmails as string[]) || [],
        isEnabled: emailConfig.isEnabled || false,
        cooldownMinutes: emailConfig.cooldownMinutes || 30,
      }));
    }
  }, [emailConfig]);

  const saveTqMutation = trpc.tq.saveConfig.useMutation({
    onSuccess: () => toast.success("天勤配置已保存"),
    onError: (e) => toast.error("保存失败: " + e.message),
  });
  const startServiceMutation = trpc.tq.startService.useMutation({
    onSuccess: () => { toast.success("数据服务已启动"); refetchStatus(); },
    onError: (e) => toast.error("启动失败: " + e.message),
  });
  const stopServiceMutation = trpc.tq.stopService.useMutation({
    onSuccess: () => { toast.success("数据服务已停止"); refetchStatus(); },
  });
  const saveEmailMutation = trpc.email.saveConfig.useMutation({
    onSuccess: () => toast.success("邮件配置已保存"),
    onError: (e) => toast.error("保存失败: " + e.message),
  });
  const testConnectionMutation = trpc.email.testConnection.useMutation({
    onSuccess: (r) => {
      setTestEmailResult(r);
      if (r.success) toast.success("SMTP连接测试成功！");
      else toast.error("连接失败: " + r.error);
    },
  });
  const sendTestMutation = trpc.email.sendTest.useMutation({
    onSuccess: (r: any) => {
      if (r.success) toast.success("测试邮件发送成功，请检查收件箱");
      else toast.error("发送失败: " + r.error);
    },
  });

  const toggleContract = (contract: string) => {
    setTqForm(prev => ({
      ...prev,
      subscribedContracts: prev.subscribedContracts.includes(contract)
        ? prev.subscribedContracts.filter(c => c !== contract)
        : [...prev.subscribedContracts, contract],
    }));
  };

  const addToEmail = () => {
    const email = toEmailInput.trim();
    if (!email || !email.includes("@")) {
      toast.warning("请输入有效的邮箱地址");
      return;
    }
    if (emailForm.toEmails.includes(email)) {
      toast.warning("该邮箱已添加");
      return;
    }
    setEmailForm(prev => ({ ...prev, toEmails: [...prev.toEmails, email] }));
    setToEmailInput("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">系统配置</h1>
        <p className="text-sm text-muted-foreground mt-1">配置天勤量化账户、数据订阅和邮件报警</p>
      </div>

      <Tabs defaultValue="tq">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="tq" className="gap-2">
            <Database className="h-3.5 w-3.5" />
            天勤量化
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-3.5 w-3.5" />
            邮件报警
          </TabsTrigger>
        </TabsList>

        {/* TQ Config */}
        <TabsContent value="tq" className="mt-4 space-y-4">
          {/* Service Status */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  数据服务状态
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${serviceStatus?.isRunning ? "border-green-500/40 text-green-400" : "border-border text-muted-foreground"}`}>
                    {serviceStatus?.isRunning ? "运行中" : "已停止"}
                  </Badge>
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                    {serviceStatus?.mode === "live" ? "实盘" : "模拟"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {serviceStatus?.mode === "live"
                  ? "已连接天勤量化，正在接收实时行情数据"
                  : "当前使用模拟数据。配置天勤账户后启动服务即可接收真实行情。"}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => startServiceMutation.mutateAsync()}
                  disabled={startServiceMutation.isPending}
                >
                  <Play className="h-3.5 w-3.5" />
                  启动数据服务
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-card border-border"
                  onClick={() => stopServiceMutation.mutate()}
                  disabled={stopServiceMutation.isPending}
                >
                  <Square className="h-3.5 w-3.5" />
                  停止服务
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* TQ Account */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">天勤量化账户</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">天勤用户名</Label>
                  <Input
                    value={tqForm.tqUsername}
                    onChange={e => setTqForm(p => ({ ...p, tqUsername: e.target.value }))}
                    placeholder="请输入天勤量化用户名"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">天勤密码</Label>
                  <Input
                    type="password"
                    value={tqForm.tqPassword}
                    onChange={e => setTqForm(p => ({ ...p, tqPassword: e.target.value }))}
                    placeholder="请输入天勤量化密码"
                    className="bg-background border-border"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                天勤量化账户用于获取国债期货实时行情数据。如无账户，可前往
                <a href="https://www.shinnytech.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">天勤官网</a>
                注册。未配置时系统使用模拟数据。
              </p>
            </CardContent>
          </Card>

          {/* Contract Subscription */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">订阅合约</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {CONTRACTS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => toggleContract(c.value)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                      tqForm.subscribedContracts.includes(c.value)
                        ? "bg-primary/10 border-primary/50 text-foreground"
                        : "bg-background border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.desc}</p>
                    </div>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${tqForm.subscribedContracts.includes(c.value) ? "bg-primary border-primary" : "border-border"}`}>
                      {tqForm.subscribedContracts.includes(c.value) && <div className="w-2 h-2 bg-white rounded-sm" />}
                    </div>
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">K线周期</Label>
                <div className="flex flex-wrap gap-2">
                  {PERIODS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setTqForm(prev => ({ ...prev, klinePeriod: p.value }))}
                      className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                        tqForm.klinePeriod === p.value
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={() => saveTqMutation.mutate(tqForm)} disabled={saveTqMutation.isPending}>
                {saveTqMutation.isPending ? "保存中..." : "保存天勤配置"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Config */}
        <TabsContent value="email" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  邮件报警配置
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">启用报警</Label>
                  <Switch
                    checked={emailForm.isEnabled}
                    onCheckedChange={v => setEmailForm(p => ({ ...p, isEnabled: v }))}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* SMTP */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">SMTP服务器</Label>
                  <Input
                    value={emailForm.smtpHost}
                    onChange={e => setEmailForm(p => ({ ...p, smtpHost: e.target.value }))}
                    placeholder="smtp.qq.com / smtp.gmail.com"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">端口</Label>
                  <Input
                    type="number"
                    value={emailForm.smtpPort}
                    onChange={e => setEmailForm(p => ({ ...p, smtpPort: parseInt(e.target.value) || 465 }))}
                    className="bg-background border-border"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">SMTP用户名</Label>
                  <Input
                    value={emailForm.smtpUser}
                    onChange={e => setEmailForm(p => ({ ...p, smtpUser: e.target.value }))}
                    placeholder="your@email.com"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SMTP密码/授权码</Label>
                  <Input
                    type="password"
                    value={emailForm.smtpPassword}
                    onChange={e => setEmailForm(p => ({ ...p, smtpPassword: e.target.value }))}
                    placeholder="邮箱密码或应用授权码"
                    className="bg-background border-border"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">发件人邮箱</Label>
                  <Input
                    value={emailForm.fromEmail}
                    onChange={e => setEmailForm(p => ({ ...p, fromEmail: e.target.value }))}
                    placeholder="可留空，默认使用SMTP用户名"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">报警冷却时间（分钟）</Label>
                  <Input
                    type="number"
                    value={emailForm.cooldownMinutes}
                    onChange={e => setEmailForm(p => ({ ...p, cooldownMinutes: parseInt(e.target.value) || 30 }))}
                    className="bg-background border-border"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">SSL/TLS加密</Label>
                <Switch
                  checked={emailForm.smtpSecure}
                  onCheckedChange={v => setEmailForm(p => ({ ...p, smtpSecure: v }))}
                />
              </div>

              {/* To Emails */}
              <div className="space-y-2">
                <Label className="text-xs">收件人邮箱</Label>
                <div className="flex gap-2">
                  <Input
                    value={toEmailInput}
                    onChange={e => setToEmailInput(e.target.value)}
                    placeholder="输入收件人邮箱后按添加"
                    className="bg-background border-border"
                    onKeyDown={e => e.key === "Enter" && addToEmail()}
                  />
                  <Button variant="outline" size="sm" onClick={addToEmail} className="bg-card border-border shrink-0">
                    添加
                  </Button>
                </div>
                {emailForm.toEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {emailForm.toEmails.map(email => (
                      <div key={email} className="flex items-center gap-1 bg-accent rounded-md px-2 py-1 text-xs">
                        <span>{email}</span>
                        <button
                          onClick={() => setEmailForm(p => ({ ...p, toEmails: p.toEmails.filter(e => e !== email) }))}
                          className="text-muted-foreground hover:text-destructive ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SMTP Tips */}
              <div className="p-3 bg-accent/50 rounded-lg text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">常用SMTP配置参考：</p>
                <p>• QQ邮箱：smtp.qq.com，端口465，需开启SMTP并获取授权码</p>
                <p>• 163邮箱：smtp.163.com，端口465，需开启SMTP并设置客户端授权密码</p>
                <p>• Gmail：smtp.gmail.com，端口587，需开启两步验证并生成应用密码</p>
              </div>

              {/* Test Result */}
              {testEmailResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${testEmailResult.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {testEmailResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {testEmailResult.success ? "SMTP连接测试成功" : `连接失败: ${testEmailResult.error}`}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => saveEmailMutation.mutate(emailForm)} disabled={saveEmailMutation.isPending}>
                  {saveEmailMutation.isPending ? "保存中..." : "保存邮件配置"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 bg-card border-border"
                  onClick={() => testConnectionMutation.mutate({
                    smtpHost: emailForm.smtpHost,
                    smtpPort: emailForm.smtpPort,
                    smtpSecure: emailForm.smtpSecure,
                    smtpUser: emailForm.smtpUser,
                    smtpPassword: emailForm.smtpPassword,
                  })}
                  disabled={testConnectionMutation.isPending}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  测试SMTP连接
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 bg-card border-border"
                  onClick={() => sendTestMutation.mutate()}
                  disabled={sendTestMutation.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  发送测试邮件
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
