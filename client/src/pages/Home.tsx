import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, TrendingUp, BarChart3, Users, Zap } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
        {/* Navigation */}
        <nav className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent-foreground" />
              </div>
              <h1 className="text-xl font-bold">Treasury Futures</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Welcome, {user?.name}</span>
              <Button variant="outline" size="sm">
                Logout
              </Button>
            </div>
          </div>
        </nav>

        {/* Dashboard Grid */}
        <div className="container py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Email Signals Card */}
            <Link href="/signals">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
                    <Zap className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">Email Signals</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Monitor and analyze trading signals from emails
                </p>
                <div className="flex items-center text-accent text-sm font-medium">
                  View Signals <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* Fundamental Analysis Card */}
            <Link href="/analysis">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                    <BarChart3 className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">Fundamental Analysis</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  AI-powered treasury market analysis and insights
                </p>
                <div className="flex items-center text-blue-500 text-sm font-medium">
                  View Analysis <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* External Views Card */}
            <Link href="/views">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                    <Users className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">External Views</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Aggregated analyst opinions and market consensus
                </p>
                <div className="flex items-center text-purple-500 text-sm font-medium">
                  View Consensus <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>

            {/* Trade Review Card */}
            <Link href="/trades">
              <Card className="card-elegant cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">Trade Review</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Analyze your trades and improve performance
                </p>
                <div className="flex items-center text-green-500 text-sm font-medium">
                  View Trades <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Card>
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="card-elegant lg:col-span-2">
              <h3 className="text-lg font-semibold mb-6">Recent Activity</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                  <div>
                    <p className="font-medium">New Signal Received</p>
                    <p className="text-sm text-muted-foreground">Buy signal for T2406</p>
                  </div>
                  <span className="badge-accent">2 min ago</span>
                </div>
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                  <div>
                    <p className="font-medium">Analysis Generated</p>
                    <p className="text-sm text-muted-foreground">Fundamental analysis updated</p>
                  </div>
                  <span className="badge-accent">15 min ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Trade Closed</p>
                    <p className="text-sm text-muted-foreground">T2403 position closed with +25 points</p>
                  </div>
                  <span className="badge-accent">1 hour ago</span>
                </div>
              </div>
            </Card>

            {/* Quick Stats */}
            <Card className="card-elegant">
              <h3 className="text-lg font-semibold mb-6">Performance</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Win Rate</p>
                  <p className="text-3xl font-bold text-accent">68%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Total P&L</p>
                  <p className="text-3xl font-bold text-green-500">+1,250</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Active Trades</p>
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
      {/* Navigation */}
      <nav className="border-b border-border/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold">Treasury Futures Platform</h1>
          </div>
          <a href={getLoginUrl()}>
            <Button className="button-primary">Sign In</Button>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex items-center">
        <div className="container py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                  Master Treasury Futures Trading
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  An elegant and sophisticated platform for professional treasury futures analysis,
                  signal monitoring, and trade optimization.
                </p>
              </div>

              {/* Features */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">Email Signal Monitoring</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically capture and analyze trading signals from emails
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">AI-Powered Analysis</p>
                    <p className="text-sm text-muted-foreground">
                      Get intelligent insights on fundamental market conditions
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">Consensus Building</p>
                    <p className="text-sm text-muted-foreground">
                      Synthesize analyst views into actionable market consensus
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">Trade Optimization</p>
                    <p className="text-sm text-muted-foreground">
                      Review and improve your trading performance with detailed analysis
                    </p>
                  </div>
                </div>
              </div>

              <a href={getLoginUrl()}>
                <Button size="lg" className="button-primary">
                  Get Started <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
            </div>

            {/* Right Visual */}
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-transparent rounded-2xl blur-3xl" />
                <Card className="card-elegant relative backdrop-blur-sm border-accent/20">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Market Overview</h3>
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
                      <p className="text-xs text-muted-foreground mb-3">Active Signals</p>
                      <div className="flex gap-2">
                        <span className="badge-accent">Buy Signal</span>
                        <span className="badge-accent">Hold</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16 text-sm text-muted-foreground">
          <p>&copy; 2026 Treasury Futures Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
