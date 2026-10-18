import { z } from "zod";

export const brandSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less").trim(),
  industry: z.string().min(1, "Industry is required").max(100, "Industry must be 100 characters or less").trim(),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
});

export type BrandFormData = z.infer<typeof brandSchema>;

export const audienceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less").trim(),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  filters: z.object({
    subreddits: z.array(z.string()),
    minKarma: z.number().int().min(0, "Must be 0 or greater").nullable(),
    minPosts: z.number().int().min(0, "Must be 0 or greater").nullable(),
    tiers: z.array(z.string()),
  }),
});

export type AudienceFormData = z.infer<typeof audienceSchema>;

export const settingsAnalysisSchema = z.object({
  maxMentionsPerBrand: z.number().int().min(10, "Minimum 10").max(200, "Maximum 200"),
  maxSubreddits: z.number().int().min(5, "Minimum 5").max(50, "Maximum 50"),
  sentimentConfidenceThreshold: z.number().int().min(50, "Minimum 50%").max(100, "Maximum 100%"),
});

export const settingsJobsSchema = z.object({
  maxConcurrent: z.number().int().min(1, "Minimum 1").max(5, "Maximum 5"),
  timeoutMinutes: z.number().int().min(5, "Minimum 5 minutes").max(30, "Maximum 30 minutes"),
});
