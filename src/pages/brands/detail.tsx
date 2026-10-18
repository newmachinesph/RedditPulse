import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  IconArrowLeft,
  IconAnalyze,
  IconMessageCircle,
  IconUsers,
  IconTrendingUp,
  IconExternalLink,
  IconLoader2,
  IconPlayerPlay,
  IconDownload,
} from "@tabler/icons-react";
import { PageLayout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";
import { toast } from "sonner";
import { getSentimentColor, formatRelativeTime, downloadCsv } from "@/lib/utils";
import { safeJsonParse } from "@/lib/safe-parse";
import { SentimentChart } from "@/components/charts";
import type { Brand, RedditPost, BrandAnalysisResult, SavedAnalysisRecord } from "@/lib/types";

export function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<BrandAnalysisResult | null>(null);
  const [scrapedPosts, setScrapedPosts] = useState<RedditPost[]>([]);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  useEffect(() => {
    const loadBrandAndAnalysis = async () => {
      if (!id) return;

      setIsLoading(true);
      setLoadError(null);

      try {
        // Load brand
        const result = await invoke<Brand | null>("get_brand", { id });
        if (result) {
          setBrand(result);

          // Load latest saved analysis
          const savedAnalysis = await invoke<SavedAnalysisRecord | null>(
            "get_latest_brand_analysis",
            { brandId: id }
          );

          if (savedAnalysis) {
            const analysis = safeJsonParse<BrandAnalysisResult | null>(savedAnalysis.analysisData, null);
            const posts = safeJsonParse<RedditPost[]>(savedAnalysis.postsData, []);
            if (analysis) setAnalysisResult(analysis);
            setScrapedPosts(posts);
            setLastAnalyzedAt(savedAnalysis.createdAt);
          }
        } else {
          setLoadError("Brand not found");
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Failed to load brand");
      } finally {
        setIsLoading(false);
      }
    };

    loadBrandAndAnalysis();
  }, [id]);

  // Poll for job status updates
  useEffect(() => {
    if (!currentJobId || !isAnalyzing) return;

    const pollInterval = setInterval(async () => {
      try {
        const job = await invoke<{
          id: string;
          status: string;
          progress: number;
          error: string | null;
        } | null>("get_job", { id: currentJobId });

        if (!job) {
          clearInterval(pollInterval);
          return;
        }

        setAnalysisProgress(job.progress);

        // Update step message based on progress
        if (job.progress < 30) {
          setAnalysisStep("Searching Reddit...");
        } else if (job.progress < 50) {
          setAnalysisStep("Scraping posts...");
        } else if (job.progress < 85) {
          setAnalysisStep("Analyzing with AI...");
        } else if (job.progress < 100) {
          setAnalysisStep("Saving results...");
        }

        if (job.status === "completed") {
          clearInterval(pollInterval);
          setIsAnalyzing(false);
          setCurrentJobId(null);
          setAnalysisStep("");
          setAnalysisProgress(0);

          // Reload the analysis data
          const savedAnalysis = await invoke<SavedAnalysisRecord | null>(
            "get_latest_brand_analysis",
            { brandId: id }
          );

          if (savedAnalysis) {
            const analysis = safeJsonParse<BrandAnalysisResult | null>(savedAnalysis.analysisData, null);
            const posts = safeJsonParse<RedditPost[]>(savedAnalysis.postsData, []);
            if (analysis) setAnalysisResult(analysis);
            setScrapedPosts(posts);
            setLastAnalyzedAt(savedAnalysis.createdAt);
          }
        } else if (job.status === "failed") {
          clearInterval(pollInterval);
          setIsAnalyzing(false);
          setCurrentJobId(null);
          setAnalysisStep("");
          setAnalysisProgress(0);
          setAnalysisError(job.error || "Analysis failed");
        } else if (job.status === "cancelled") {
          clearInterval(pollInterval);
          setIsAnalyzing(false);
          setCurrentJobId(null);
          setAnalysisStep("");
          setAnalysisProgress(0);
        }
      } catch (e) {
        console.error("Failed to poll job status:", e);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [currentJobId, isAnalyzing, id]);

  // Check for running job on mount
  useEffect(() => {
    const checkRunningJob = async () => {
      if (!id) return;

      try {
        const jobs = await invoke<Array<{
          id: string;
          status: string;
          brandId: string | null;
        }>>("get_brand_jobs", { brandId: id });

        const runningJob = jobs.find((j) => j.status === "running" || j.status === "pending");
        if (runningJob) {
          setCurrentJobId(runningJob.id);
          setIsAnalyzing(true);
        }
      } catch (e) {
        console.error("Failed to check running jobs:", e);
      }
    };

    checkRunningJob();
  }, [id]);

  const runAnalysis = async () => {
    if (!brand || !id) return;

    setIsAnalyzing(true);
    setAnalysisStep("Starting analysis...");
    setAnalysisProgress(0);
    setAnalysisError(null);

    try {
      // Start background analysis
      const result = await invoke<{ jobId: string }>("start_background_analysis", {
        input: { brandId: id },
      });

      setCurrentJobId(result.jobId);
      // The polling effect will take over from here

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to start analysis";
      setAnalysisError(errorMessage);
      setAnalysisStep("");
      setIsAnalyzing(false);
    }
  };

  const handleExportAnalysis = async () => {
    if (!brand) return;
    try {
      const csvContent = await invoke<string>("export_analysis_csv", { brandId: brand.id });
      downloadCsv(csvContent, `${brand.name.toLowerCase().replace(/\s+/g, "-")}-analysis-${new Date().toISOString().split("T")[0]}.csv`);
      toast.success("CSV exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export analysis");
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Loading..." subtitle="">
        <div className="flex items-center justify-center py-12">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (loadError || !brand) {
    return (
      <PageLayout title="Error" subtitle="">
        <Card className="flex flex-col items-center justify-center py-12">
          <p className="text-destructive">{loadError || "Brand not found"}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/brands")}>
            Back to Brands
          </Button>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={brand.name} subtitle={brand.industry}>
      {/* Back Link */}
      <Link
        to="/brands"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to Brands
      </Link>

      {/* Header Stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard
          title="Sentiment"
          value={analysisResult ? analysisResult.overallSentiment.label : "Not analyzed"}
          valueClass={analysisResult ? getSentimentColor(analysisResult.overallSentiment.score) : ""}
          icon={IconTrendingUp}
        />
        <StatCard
          title="Posts Analyzed"
          value={scrapedPosts.length.toString()}
          icon={IconMessageCircle}
        />
        <StatCard
          title="Confidence"
          value={analysisResult ? `${Math.round(analysisResult.overallSentiment.confidence * 100)}%` : "-"}
          icon={IconUsers}
        />
        <StatCard
          title="Themes"
          value={analysisResult ? analysisResult.topThemes.length.toString() : "-"}
          icon={IconAnalyze}
        />
      </div>

      {/* Actions */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button onClick={runAnalysis} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <IconLoader2 className="h-4 w-4 animate-spin" />
                {analysisStep || "Analyzing..."} {analysisProgress > 0 && `(${analysisProgress}%)`}
              </>
            ) : (
              <>
                <IconPlayerPlay className="h-4 w-4" />
                {analysisResult ? "Re-analyze" : "Analyze Brand"}
              </>
            )}
          </Button>
          {brand.website && (
            <Button variant="outline" asChild>
              <a href={brand.website} target="_blank" rel="noopener noreferrer">
                <IconExternalLink className="h-4 w-4" />
                Visit Website
              </a>
            </Button>
          )}
          {lastAnalyzedAt && (
            <span className="text-sm text-muted-foreground">
              Last analyzed {formatRelativeTime(lastAnalyzedAt)}
            </span>
          )}
        </div>
        {analysisError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{analysisError}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mentions">Mentions ({scrapedPosts.length})</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {analysisResult ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Summary */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Analysis Summary</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleExportAnalysis}>
                    <IconDownload className="h-4 w-4" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{analysisResult.summary}</p>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysisResult.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Sentiment Score */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Overall Sentiment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className={`text-4xl font-bold ${getSentimentColor(analysisResult.overallSentiment.score)}`}>
                        {analysisResult.overallSentiment.score.toFixed(1)}
                      </p>
                      <p className="text-sm text-muted-foreground">Score (-2 to +2)</p>
                    </div>
                    <div>
                      <Badge variant={analysisResult.overallSentiment.score >= 0.5 ? "positive" : analysisResult.overallSentiment.score >= -0.5 ? "neutral" : "negative"}>
                        {analysisResult.overallSentiment.label}
                      </Badge>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {Math.round(analysisResult.overallSentiment.confidence * 100)}% confidence
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sentiment Trend Chart */}
              <div className="lg:col-span-2">
                <SentimentChart brandId={brand.id} />
              </div>
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center py-12">
              <IconAnalyze className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No analysis yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Click "Analyze Brand" to search Reddit and analyze sentiment
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mentions">
          {scrapedPosts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Reddit Mentions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {scrapedPosts.map((post) => {
                    const mentionAnalysis = analysisResult?.mentionAnalyses.find(
                      (m) => m.postId === post.id
                    );

                    return (
                      <div key={post.id} className="rounded-lg border border-border p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:text-primary"
                            >
                              {post.title}
                            </a>
                            <p className="mt-1 text-sm text-muted-foreground">
                              r/{post.subreddit} • u/{post.author} • {post.score} pts
                            </p>
                            {post.selftext && (
                              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                {post.selftext}
                              </p>
                            )}
                          </div>
                          {mentionAnalysis && (
                            <Badge
                              variant={
                                mentionAnalysis.sentiment.score >= 0.5
                                  ? "positive"
                                  : mentionAnalysis.sentiment.score >= -0.5
                                  ? "neutral"
                                  : "negative"
                              }
                            >
                              {mentionAnalysis.sentiment.label}
                            </Badge>
                          )}
                        </div>
                        {mentionAnalysis && mentionAnalysis.keyPoints.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Key Points:</p>
                            <ul className="text-sm space-y-1">
                              {mentionAnalysis.keyPoints.slice(0, 2).map((point, i) => (
                                <li key={i} className="text-muted-foreground">• {point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center py-12">
              <IconMessageCircle className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No mentions yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Run an analysis to find Reddit mentions
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="themes">
          {analysisResult && analysisResult.topThemes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {analysisResult.topThemes.map((theme) => (
                <Card key={theme.theme}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{theme.theme}</CardTitle>
                      <Badge variant={theme.sentiment >= 0.5 ? "positive" : theme.sentiment >= -0.5 ? "neutral" : "negative"}>
                        {theme.sentiment >= 0 ? "+" : ""}{theme.sentiment.toFixed(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Mentioned {theme.frequency} times
                    </p>
                    {theme.exampleQuotes.length > 0 && (
                      <div className="space-y-2">
                        {theme.exampleQuotes.slice(0, 2).map((quote, i) => (
                          <p key={i} className="text-sm italic text-muted-foreground">
                            "{quote}"
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center py-12">
              <IconAnalyze className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No themes yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Run an analysis to discover recurring themes
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}

function StatCard({
  title,
  value,
  valueClass,
  icon: Icon,
}: {
  title: string;
  value: string;
  valueClass?: string;
  icon: typeof IconTrendingUp;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-xl font-semibold ${valueClass || ""}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
