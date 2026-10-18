import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { IconLoader2, IconChartLine } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

interface SentimentTrendPoint {
  date: string;
  sentimentScore: number;
  sentimentLabel: string;
  postCount: number;
}

interface SentimentChartProps {
  brandId: string;
}

export function SentimentChart({ brandId }: SentimentChartProps) {
  const [data, setData] = useState<SentimentTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrendData();
  }, [brandId]);

  const loadTrendData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<SentimentTrendPoint[]>("get_sentiment_trend", {
        brandId,
        limit: 30,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trend data");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getSentimentColor = (score: number) => {
    if (score >= 0.5) return "#22c55e"; // green
    if (score >= -0.5) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconChartLine className="h-5 w-5" />
            Sentiment Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconChartLine className="h-5 w-5" />
            Sentiment Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-destructive">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconChartLine className="h-5 w-5" />
            Sentiment Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <IconChartLine className="h-12 w-12 mb-2 opacity-50" />
            <p>No trend data yet</p>
            <p className="text-sm">Run multiple analyses to see trends</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats
  const avgScore = data.reduce((sum, d) => sum + d.sentimentScore, 0) / data.length;
  const latestScore = data[data.length - 1]?.sentimentScore ?? 0;
  const previousScore = data.length > 1 ? data[data.length - 2]?.sentimentScore ?? 0 : latestScore;
  const trend = latestScore - previousScore;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconChartLine className="h-5 w-5" />
            Sentiment Trend
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Avg: </span>
              <span className="font-semibold" style={{ color: getSentimentColor(avgScore) }}>
                {avgScore.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Trend: </span>
              <span className={`font-semibold ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
                {trend >= 0 ? "+" : ""}{trend.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                domain={[-2, 2]}
                ticks={[-2, -1, 0, 1, 2]}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const point = payload[0].payload as SentimentTrendPoint;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md">
                        <p className="font-semibold">{formatDate(point.date)}</p>
                        <p className="text-sm">
                          Score:{" "}
                          <span style={{ color: getSentimentColor(point.sentimentScore) }}>
                            {point.sentimentScore.toFixed(2)}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {point.sentimentLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {point.postCount} posts analyzed
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="sentimentScore"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
