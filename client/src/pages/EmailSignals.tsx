import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";

export default function EmailSignals() {
  const [filter, setFilter] = useState<"all" | "pending" | "executed">("all");
  const { data: signals, isLoading } = trpc.emailSignals.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const filteredSignals = signals?.filter((signal) => {
    if (filter === "all") return true;
    return signal.status === filter;
  }) || [];

  const getSignalIcon = (type: string) => {
    return type === "buy" ? (
      <TrendingUp className="w-5 h-5 text-green-500" />
    ) : (
      <TrendingDown className="w-5 h-5 text-red-500" />
    );
  };

  const getSignalColor = (type: string) => {
    switch (type) {
      case "buy":
        return "bg-green-500/10 text-green-600";
      case "sell":
        return "bg-red-500/10 text-red-600";
      case "hold":
        return "bg-yellow-500/10 text-yellow-600";
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
            <h1 className="text-2xl font-bold">Email Trading Signals</h1>
            <p className="text-sm text-muted-foreground">
              Monitor and manage trading signals from email sources
            </p>
          </div>
          <Button className="button-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Signal
          </Button>
        </div>
      </div>

      <div className="container py-8">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <div className="flex gap-2">
            {(["all", "pending", "executed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === f
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Signals List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="card-elegant">
              <div className="h-20 flex items-center justify-center">
                <p className="text-muted-foreground">Loading signals...</p>
              </div>
            </Card>
          ) : filteredSignals.length === 0 ? (
            <Card className="card-elegant">
              <div className="h-32 flex flex-col items-center justify-center">
                <p className="text-muted-foreground mb-4">No signals found</p>
                <Button className="button-primary">Create First Signal</Button>
              </div>
            </Card>
          ) : (
            filteredSignals.map((signal) => (
              <Card key={signal.id} className="card-elegant">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-2.5 bg-accent/10 rounded-lg">
                      {getSignalIcon(signal.signalType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{signal.contract}</h3>
                        <Badge className={getSignalColor(signal.signalType)}>
                          {signal.signalType.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {signal.status
                            ? signal.status.charAt(0).toUpperCase() +
                              signal.status.slice(1)
                            : "Unknown"}
                        </Badge>
                      </div>
                      {signal.emailSubject && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {signal.emailSubject}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        {signal.price && (
                          <span>
                            Price: <span className="font-semibold">{signal.price}</span>
                          </span>
                        )}
                        <span>
                          Confidence:{" "}
                          <span className="font-semibold">{signal.confidence}%</span>
                        </span>
                        <span className="text-muted-foreground">
                          {signal.signalTime
                            ? new Date(signal.signalTime).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
