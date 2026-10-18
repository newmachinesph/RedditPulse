import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

export function getSentimentColor(score: number): string {
  if (score >= 1.5) return "text-positive";
  if (score >= 0.5) return "text-neutral";
  if (score >= -0.5) return "text-mixed";
  if (score >= -1.5) return "text-negative";
  return "text-hostile";
}

export function getSentimentLabel(score: number): string {
  if (score >= 1.5) return "Positive";
  if (score >= 0.5) return "Neutral";
  if (score >= -0.5) return "Mixed";
  if (score >= -1.5) return "Negative";
  return "Hostile";
}

export function getSentimentBgColor(score: number): string {
  if (score >= 1.5) return "bg-positive/20";
  if (score >= 0.5) return "bg-neutral/20";
  if (score >= -0.5) return "bg-mixed/20";
  if (score >= -1.5) return "bg-negative/20";
  return "bg-hostile/20";
}

export function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
