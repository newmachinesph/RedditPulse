// Brand types
export interface Brand {
  id: string;
  name: string;
  industry: string;
  description?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandAnalysis {
  id: string;
  brandId: string;
  sentimentScore: number; // -2 to +2
  trustLevel: number; // 1-10
  confidenceScore: number; // 0-100
  mentionCount: number;
  themes: string[];
  riskFactors: string[];
  summary: string;
  createdAt: string;
}

export type SentimentLevel = "positive" | "neutral" | "mixed" | "negative" | "hostile";

// Mention types
export interface Mention {
  id: string;
  brandId: string;
  subredditId: string;
  redditPostId: string;
  author: string;
  title: string;
  body: string;
  score: number;
  commentCount: number;
  sentiment: SentimentLevel;
  sentimentScore: number;
  url: string;
  createdAt: string;
}

// Subreddit types
export interface Subreddit {
  id: string;
  name: string;
  description?: string;
  subscribers: number;
  createdAt: string;
}

// Audience types
export interface Audience {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  createdAt: string;
}

// Influencer types
export interface Influencer {
  id: string;
  username: string;
  totalKarma: number;
  postCount: number;
  avgScore: number;
  tier: "mega" | "macro" | "micro" | "nano";
  expertiseTags: string[];
  createdAt: string;
}

// Job types
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type JobType = "brand_analysis" | "audience_build" | "influencer_scan" | "competitor_compare";

export interface Job {
  id: string;
  jobType: string;
  status: string;
  brandId: string | null;
  progress: number; // 0-100
  output: string;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Settings types
export interface Settings {
  serperApiKey: string;
  openaiApiKey: string;
  claudeApiKey: string;
  aiProvider: "openai" | "claude";
  proxy: ProxySettings;
  analysis: AnalysisSettings;
  jobs: JobSettings;
}

export interface ProxySettings {
  enabled: boolean;
  server: string;
  username: string;
  password: string;
  protocol: "http" | "socks5";
}

export interface AnalysisSettings {
  maxMentionsPerBrand: number;
  maxSubreddits: number;
  sentimentConfidenceThreshold: number;
}

export interface JobSettings {
  maxConcurrent: number;
  timeoutMinutes: number;
}

// Analysis summary (used by dashboard and brands list)
export interface AnalysisSummary {
  brandId: string;
  overallSentimentScore: number;
  overallSentimentLabel: string;
  postCount: number;
  lastAnalyzedAt: string;
}

// Saved analysis record from backend
export interface SavedAnalysisRecord {
  id: string;
  brandId: string;
  analysisData: string;
  postsData: string;
  postCount: number;
  overallSentimentScore: number;
  overallSentimentLabel: string;
  createdAt: string;
}

// Reddit data types (from scraping)
export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  createdUtc: number;
}

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  selftext: string | null;
  url: string;
  permalink: string;
  score: number;
  numComments: number;
  createdUtc: number;
  comments: RedditComment[];
}

// Parsed brand analysis result (from JSON in analysisData)
export interface BrandAnalysisResult {
  brandName: string;
  overallSentiment: {
    score: number;
    label: string;
    confidence: number;
  };
  topThemes: Array<{
    theme: string;
    frequency: number;
    sentiment: number;
    exampleQuotes: string[];
  }>;
  mentionAnalyses: Array<{
    postId: string;
    sentiment: { score: number; label: string; confidence: number };
    topics: string[];
    keyPoints: string[];
    isRecommendation: boolean;
    isComplaint: boolean;
    authorIntent: string;
  }>;
  recommendations: string[];
  summary: string;
}

// Audience types (extended)
export interface AudienceFilters {
  subreddits: string[];
  minKarma: number | null;
  minPosts: number | null;
  tiers: string[];
}

export interface AudienceWithFilters {
  id: string;
  name: string;
  description: string | null;
  brandId: string | null;
  memberCount: number;
  filters: AudienceFilters;
  createdAt: string;
}

export interface AudienceMember {
  audienceId: string;
  authorId: string;
  username: string;
  totalKarma: number;
  postCount: number;
  avgScore: number;
  addedAt: string;
}

// Influencer types (extended)
export interface InfluencerWithAuthor {
  id: string;
  username: string;
  totalKarma: number;
  postCount: number;
  avgScore: number;
  tier: string;
  expertiseTags: string[];
  engagementRate: number;
  brandNames: string[];
  createdAt: string;
}

export interface DiscoveredInfluencer {
  username: string;
  postCount: number;
  totalScore: number;
  avgScore: number;
  totalComments: number;
  subreddits: string[];
  sentiment: string;
}

export interface DiscoverInfluencersResult {
  discovered: DiscoveredInfluencer[];
  savedCount: number;
}

// Competitor types (extended)
export interface CompetitorWithBrand {
  id: string;
  brandId: string;
  competitorBrandId: string;
  competitorName: string;
  competitorIndustry: string;
  relationship: string;
  createdAt: string;
}

export interface BrandWithAnalysis {
  brand: Brand;
  analysis: BrandAnalysisResult | null;
  postCount: number;
}

// Pricing types
export interface PricingCalculation {
  brandId: string;
  basePrice: number;
  sentimentPenalty: number;
  trustPenalty: number;
  difficultyPremium: number;
  finalPrice: number;
  volumeRecommendation: number;
  scenarios: PricingScenario[];
  createdAt: string;
}

export interface PricingScenario {
  tier: "good" | "better" | "best";
  monthlyVolume: number;
  pricePerLead: number;
  discount: number;
  monthlyCost: number;
  annualCost: number;
}
