import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, TrendingUp, BarChart3, Users, Zap, Mail, Activity, Brain, AlertCircle, Settings } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
        {/* 导航栏 */}
        <nav className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent-foreground" />
              </div>
              <h1 className="text-xl font-bold">国债期货平台</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">欢迎，{user?.name}</span>
              <Button variant="outline" size="sm">
                退出登录
              </Button>
            </div>
          </div>
        </nav>

        {/* 仪表盘网格 */}
        <div className="container py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
            {/* 邮件自动化卡片 */}
            <Link href="/email-automation">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                    <Mail className="w-6 h-6 text-orange-500" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">邮件自动化</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  配置和管理邮件自动抓取
                </p>
                <div className="flex items-center text-orange-500 text-sm font-medium">
                  配置自动化 <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* 邮件信号卡片 */}
            <Link href="/signals">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
                    <Zap className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">邮件信号</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  监控和分析来自邮件的交易信号
                </p>
                <div className="flex items-center text-accent text-sm font-medium">
                  查看信号 <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* 基本面分析卡片 */}
            <Link href="/analysis">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <BarChart3 className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">基本面分析</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  AI 驱动的国债市场分析和洞察
                </p>
                <div className="flex items-center text-blue-500 text-sm font-medium">
                  查看分析 <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* 外部观点卡片 */}
            <Link href="/views">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                    <Users className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">外部观点</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  汇总分析师观点和市场共识
                </p>
                <div className="flex items-center text-purple-500 text-sm font-medium">
                  查看共识 <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* 交易复盘卡片 */}
            <Link href="/trades">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">交易复盘</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  分析您的交易并改进表现
                </p>
                <div className="flex items-center text-green-500 text-sm font-medium">
                  查看交易 <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* 实时行情卡片 */}
            <Link href="/market">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                    <LineChart className="w-6 h-6 text-cyan-500" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">实时行情</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  查看K线图表和实时行情数据
                </p>
                <div className="flex items-center text-cyan-500 text-sm font-medium">
                  查看行情 <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* 自定义指标卡片 */}
            <Link href="/indicators">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                    <Sliders className="w-6 h-6 text-indigo-500" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">自定义指标</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  编辑和管理技术指标
                </p>
                <div className="flex items-center text-indigo-500 text-sm font-medium">
                  管理指标 <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* AI 分析师卡片 */}
            <Link href="/ai-analyst">
              <Card className="card-elegant cursor-pointer group border-2 border-purple-500/20 hover:border-purple-500/40 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg group-hover:from-purple-500/30 group-hover:to-blue-500/30 transition-colors">
                    <Brain className="w-6 h-6 text-purple-500" />
                  </div>
                  <span className="text-xs bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full font-medium">NEW</span>
                </div>
                <h3 className="font-semibold mb-1">AI 分析师</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  整合 FLAME 与技术形态，对 5/10/30 年期趋势综合研判
                </p>
                <div className="flex items-center text-purple-500 text-sm font-medium">
                  开始分析 <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>
          </div>

          {/* 快速统计 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="card-elegant lg:col-span-2">
              <h3 className="text-lg font-semibold mb-6">最近活动</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                  <div>
                    <p className="font-medium">收到新信号</p>
                    <p className="text-sm text-muted-foreground">T2406 买入信号</p>
                  </div>
                  <span className="badge-accent">2 分钟前</span>
                </div>
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                  <div>
                    <p className="font-medium">分析已生成</p>
                    <p className="text-sm text-muted-foreground">基本面分析已更新</p>
                  </div>
                  <span className="badge-accent">15 分钟前</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">交易已平仓</p>
                    <p className="text-sm text-muted-foreground">T2403 头寸平仓，收益 +25 点</p>
                  </div>
                  <span className="badge-accent">1 小时前</span>
                </div>
              </div>
            </Card>

            {/* 快速统计 */}
            <Card className="card-elegant">
              <h3 className="text-lg font-semibold mb-6">交易表现</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">胜率</p>
                  <p className="text-3xl font-bold text-accent">68%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">总盈亏</p>
                  <p className="text-3xl font-bold text-green-500">+1,250</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">持仓数量</p>
                  <p className="text-3xl font-bold">3</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex flex-col">
      {/* 导航栏 */}
      <nav className="border-b border-border/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold">国债期货交易平台</h1>
          </div>
          <a href={getLoginUrl()}>
            <Button className="button-primary">登录</Button>
          </a>
        </div>
      </nav>

      {/* 英雄区域 */}
      <div className="flex-1 flex items-center">
        <div className="container py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* 左侧内容 */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                  掌握国债期货交易
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  一个优雅而精致的专业平台，用于国债期货分析、信号监控和交易优化。
                </p>
              </div>

              {/* 功能列表 */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">邮件信号监控</p>
                    <p className="text-sm text-muted-foreground">
                      自动捕获和分析来自邮件的交易信号
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">AI 驱动分析</p>
                    <p className="text-sm text-muted-foreground">
                      获取基本面市场条件的智能洞察
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">共识构建</p>
                    <p className="text-sm text-muted-foreground">
                      将分析师观点综合为可行的市场共识
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">交易优化</p>
                    <p className="text-sm text-muted-foreground">
                      通过详细分析评估和改进您的交易表现
                    </p>
                  </div>
                </div>
              </div>

              <a href={getLoginUrl()}>
                <Button size="lg" className="button-primary">
                  开始使用 <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
            </div>

            {/* 右侧视觉 */}
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-transparent rounded-2xl blur-3xl" />
                <Card className="card-elegant relative backdrop-blur-sm border-accent/20">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">市场概览</h3>
                      <TrendingUp className="w-5 h-5 text-accent" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-accent/5 rounded-lg">
                        <span className="text-sm font-medium">T2406</span>
                        <span className="text-sm text-green-500">+12 bps</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-accent/5 rounded-lg">
                        <span className="text-sm font-medium">T2409</span>
                        <span className="text-sm text-red-500">-8 bps</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-accent/5 rounded-lg">
                        <span className="text-sm font-medium">T2412</span>
                        <span className="text-sm text-accent">±0 bps</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-3">活跃信号</p>
                      <div className="flex gap-2">
                        <span className="badge-accent">买入信号</span>
                        <span className="badge-accent">持仓</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 页脚 */}
      <div className="border-t border-border/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16 text-sm text-muted-foreground">
          <p>&copy; 2026 国债期货交易平台。版权所有。</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground transition-colors">
              隐私政策
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              服务条款
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              支持
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
