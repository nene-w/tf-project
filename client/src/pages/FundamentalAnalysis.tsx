// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Streamdown } from "streamdown";

export default function FundamentalAnalysis() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: analyses, refetch } = trpc.fundamentalAnalysis.list.useQuery({
    limit: 20,
    offset: 0,
  });

  const generateMutation = trpc.fundamentalAnalysis.generate.useMutation({
    onSuccess: () => {
      setIsGenerating(false);
      refetch();
    },
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    await generateMutation.mutateAsync({
      title: "Treasury Market Analysis",
      keyIndicators: ["interest_rate", "inflation", "gdp"],
    });
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case "strong_buy":
        return "bg-green-500/10 text-green-600";
      case "buy":
        return "bg-green-500/20 text-green-700";
      case "hold":
        return "bg-yellow-500/10 text-yellow-600";
      case "sell":
        return "bg-red-500/20 text-red-700";
      case "strong_sell":
        return "bg-red-500/10 text-red-600";
      default:
        return "bg-gray-500/10 text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <div className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container flex items-center justify-between h-16">
          <div>
            <h1 className="text-2xl font-bold">Fundamental Analysis</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered treasury market analysis and insights
            </p>
          </div>
          <Button
            className="button-primary"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            <Plus className="w-4 h-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate Analysis"}
          </Button>
        </div>
      </div>

      <div className="container py-8">
        {/* Analysis Cards */}
        <div className="space-y-6">
          {!analyses || analyses.length === 0 ? (
            <Card className="card-elegant">
              <div className="h-40 flex flex-col items-center justify-center">
                <p className="text-muted-foreground mb-4">
                  No analyses generated yet
                </p>
                <Button className="button-primary" onClick={handleGenerate}>
                  Generate First Analysis
                </Button>
              </div>
            </Card>
          ) : (
            analyses.map((analysis) => (
              <div key={analysis.id} className="card-elegant">
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">
                        {analysis.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(analysis.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getRecommendationColor(analysis.recommendation)}>
                        {analysis.recommendation
                          .replace(/_/g, " ")
                          .toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {analysis.riskLevel
                          ? analysis.riskLevel.charAt(0).toUpperCase() +
                            analysis.riskLevel.slice(1)
                          : "Medium"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Analysis Content */}
                {/* @ts-ignore */}
                {typeof analysis.content === "string" && (
                  <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                    <Streamdown>{analysis.content as any}</Streamdown>
                  </div>
                )}

                {/* Key Indicators */}
                {analysis.keyIndicators && (
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-sm font-semibold mb-3">Key Indicators</p>
                    <div className="flex flex-wrap gap-2">
                      {(analysis.keyIndicators as string[]).map((indicator) => (
                        <Badge key={indicator} variant="secondary">
                          {indicator}
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
