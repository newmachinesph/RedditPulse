import type { JobStatus } from "./types";

// Job status display config - shared between dashboard and jobs pages
export const JOB_STATUS_CONFIG: Record<
  JobStatus,
  { label: string; variant: "default" | "secondary" | "positive" | "negative" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  running: { label: "Running", variant: "default" },
  completed: { label: "Completed", variant: "positive" },
  failed: { label: "Failed", variant: "negative" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

// Job type human-readable labels
export const JOB_TYPE_LABELS: Record<string, string> = {
  brand_analysis: "Brand Analysis",
  reddit_search: "Reddit Search",
  reddit_scrape: "Reddit Scrape",
  audience_build: "Audience Build",
  influencer_scan: "Influencer Scan",
  competitor_compare: "Competitor Compare",
};

// Influencer tier display config
export const TIER_CONFIG: Record<
  string,
  { label: string; color: string; variant: "default" | "secondary" | "positive" | "negative" | "outline" }
> = {
  mega: { label: "Mega", color: "text-yellow-500", variant: "default" },
  macro: { label: "Macro", color: "text-purple-500", variant: "positive" },
  mid: { label: "Mid-tier", color: "text-blue-500", variant: "secondary" },
  micro: { label: "Micro", color: "text-green-500", variant: "outline" },
  nano: { label: "Nano", color: "text-muted-foreground", variant: "outline" },
};

// Tier options for audience filter forms
export const TIER_OPTIONS = [
  { value: "mega", label: "Mega" },
  { value: "macro", label: "Macro" },
  { value: "mid", label: "Mid-tier" },
  { value: "micro", label: "Micro" },
  { value: "nano", label: "Nano" },
] as const;
