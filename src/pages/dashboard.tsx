import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  IconBuildingStore,
  IconClock,
  IconCheck,
  IconX,
  IconLoader2,
  IconMoodSmile,
  IconMoodSad,
} from "@tabler/icons-react";
import { PageLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, Badge, LoadingSkeleton } from "@/components/ui";
import { OnboardingFlow } from "@/components/onboarding";
import { useBrandsStore } from "@/lib/store";
import { cn, formatRelativeTime } from "@/lib/utils";
import { JOB_STATUS_CONFIG, JOB_TYPE_LABELS } from "@/lib/constants";
import type { Job, AnalysisSummary, JobStatus } from "@/lib/types";

export function DashboardPage() {
  const navigate = useNavigate();
  const { brands, loadBrands, isLoading: brandsLoading } = useBrandsStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [analysisSummaries, setAnalysisSummaries] = useState<Map<string, AnalysisSummary>>(new Map());

  const loadAnalysisSummaries = useCallback(async () => {
    try {
      const summaries = await invoke<AnalysisSummary[]>("get_all_brand_analysis_summaries");
      const summaryMap = new Map<string, AnalysisSummary>();
      summaries.forEach((s) => summaryMap.set(s.brandId, s));
      setAnalysisSummaries(summaryMap);
    } catch (e) {
      console.error("Failed to load analysis summaries:", e);
    }
  }, []);

  useEffect(() => {
    loadBrands();
    loadJobs();
    loadAnalysisSummaries();
  }, [loadAnalysisSummaries]);

  const loadJobs = async () => {
    try {
      const result = await invoke<Job[]>("get_all_jobs", { status: null });
      setJobs(result);
    } catch (e) {
      console.error("Failed to load jobs:", e);
    } finally {
      setJobsLoading(false);
    }
  };

  const runningJobs = jobs.filter((j) => j.status === "running");

  // Calculate sentiment stats
  const summaryArray = Array.from(analysisSummaries.values());
  const analyzedBrandsCount = summaryArray.length;
  const positiveCount = summaryArray.filter((s) => s.overallSentimentLabel.toLowerCase() === "positive").length;
  const negativeCount = summaryArray.filter((s) => s.overallSentimentLabel.toLowerCase() === "negative").length;
  const totalPostsAnalyzed = summaryArray.reduce((acc, s) => acc + s.postCount, 0);

  const recentJobs = jobs.slice(0, 5);
  const isLoading = brandsLoading || jobsLoading;

  // Show onboarding wizard for first-time users
  if (!brandsLoading && brands.length === 0) {
    return <OnboardingFlow />;
  }

  return (
    <PageLayout
      title="Dashboard"
      subtitle="Overview of your brand intelligence"
      action={{
        label: "Add Brand",
        onClick: () => navigate("/brands"),
      }}
    >
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 w-24 rounded bg-muted" />
                    <div className="h-8 w-12 rounded bg-muted" />
                    <div className="h-3 w-32 rounded bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <LoadingSkeleton rows={5} columns={3} />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Brands"
              value={brands.length}
              icon={IconBuildingStore}
              description={`${analyzedBrandsCount} analyzed`}
            />
            <StatsCard
              title="Positive Sentiment"
              value={positiveCount}
              icon={IconMoodSmile}
              description="Brands with positive sentiment"
              variant="positive"
            />
            <StatsCard
              title="Negative Sentiment"
              value={negativeCount}
              icon={IconMoodSad}
              description="Brands with negative sentiment"
              variant="negative"
            />
            <StatsCard
              title="Posts Analyzed"
              value={totalPostsAnalyzed}
              icon={IconCheck}
              description={`${runningJobs.length} jobs running`}
              highlight={runningJobs.length > 0}
            />
          </div>

          {/* Main Content */}
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Recent Brands */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Your Brands</CardTitle>
                <Link
                  to="/brands"
                  className="text-sm text-primary hover:underline"
                >
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {brands.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <IconBuildingStore className="h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      No brands yet. Add your first brand to start tracking.
                    </p>
                    <Link
                      to="/brands"
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Add a brand
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {brands.slice(0, 5).map((brand) => {
                      const summary = analysisSummaries.get(brand.id);
                      return (
                        <Link
                          key={brand.id}
                          to={`/brands/${brand.id}`}
                          className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <IconBuildingStore className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{brand.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {brand.industry}
                              </p>
                            </div>
                          </div>
                          {summary ? (
                            <SentimentBadge label={summary.overallSentimentLabel} />
                          ) : (
                            <Badge variant="outline">Not analyzed</Badge>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Jobs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Jobs</CardTitle>
                <Link
                  to="/jobs"
                  className="text-sm text-primary hover:underline"
                >
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {recentJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <IconClock className="h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      No jobs yet. Run an analysis from a brand page.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentJobs.map((job) => {
                      const config = JOB_STATUS_CONFIG[job.status as JobStatus] ?? JOB_STATUS_CONFIG.pending;
                      return (
                        <div
                          key={job.id}
                          className="flex items-center gap-3 text-sm"
                        >
                          <JobStatusIcon status={job.status} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {JOB_TYPE_LABELS[job.jobType] || job.jobType}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatRelativeTime(job.createdAt)}
                            </p>
                          </div>
                          <Badge variant={config.variant} className="text-xs">
                            {config.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageLayout>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  highlight,
  variant,
}: {
  title: string;
  value: string | number;
  icon: typeof IconBuildingStore;
  description?: string;
  highlight?: boolean;
  variant?: "positive" | "negative";
}) {
  const getCardClass = () => {
    if (variant === "positive") return "border-positive/50 bg-positive/5";
    if (variant === "negative") return "border-negative/50 bg-negative/5";
    if (highlight) return "border-primary/50 bg-primary/5";
    return "";
  };

  const getIconContainerClass = () => {
    if (variant === "positive") return "bg-positive/20";
    if (variant === "negative") return "bg-negative/20";
    if (highlight) return "bg-primary/20";
    return "bg-primary/10";
  };

  const getIconClass = () => {
    if (variant === "positive") return "text-positive";
    if (variant === "negative") return "text-negative";
    return "text-primary";
  };

  const getValueClass = () => {
    if (variant === "positive") return "text-positive";
    if (variant === "negative") return "text-negative";
    if (highlight) return "text-primary";
    return "";
  };

  return (
    <Card className={getCardClass()}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn("mt-1 text-2xl font-semibold", getValueClass())}>
              {value}
            </p>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg", getIconContainerClass())}>
            <Icon className={cn("h-6 w-6", getIconClass())} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobStatusIcon({ status }: { status: string }) {
  if (status === "running") {
    return <IconLoader2 className="h-4 w-4 animate-spin text-primary" />;
  }
  if (status === "completed") {
    return <IconCheck className="h-4 w-4 text-positive" />;
  }
  if (status === "failed") {
    return <IconX className="h-4 w-4 text-negative" />;
  }
  return <IconClock className="h-4 w-4 text-muted-foreground" />;
}

function SentimentBadge({ label }: { label: string }) {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel === "positive") {
    return <Badge variant="positive">{label}</Badge>;
  }
  if (lowerLabel === "negative") {
    return <Badge variant="negative">{label}</Badge>;
  }
  return <Badge variant="secondary">{label}</Badge>;
}
