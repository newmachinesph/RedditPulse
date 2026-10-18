import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  IconSpy,
  IconTrash,
  IconExternalLink,
  IconTrendingUp,
  IconUsers,
  IconMessage,
  IconDownload,
  IconFilter,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
} from "@/components/ui";
import { cn, downloadCsv } from "@/lib/utils";
import { TIER_CONFIG } from "@/lib/constants";
import { useConfirm } from "@/lib/hooks";
import type { InfluencerWithAuthor, DiscoverInfluencersResult } from "@/lib/types";

export function InfluencersPage() {
  const [influencers, setInfluencers] = useState<InfluencerWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDiscovery, setLastDiscovery] = useState<DiscoverInfluencersResult | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  useEffect(() => {
    loadInfluencers();
  }, []);

  const loadInfluencers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<InfluencerWithAuthor[]>("get_influencers");
      setInfluencers(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load influencers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setError(null);

    try {
      const result = await invoke<DiscoverInfluencersResult>("discover_influencers");
      setLastDiscovery(result);
      toast.success(`Discovered ${result.discovered.length} users, saved ${result.savedCount} influencers`);
      await loadInfluencers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to discover influencers");
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleRemove = async (id: string, username: string) => {
    const ok = await confirm({
      title: "Remove influencer?",
      description: `This will remove u/${username} from your influencer list.`,
      confirmLabel: "Remove",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await invoke("remove_influencer", { id });
      toast.success("Influencer removed");
      await loadInfluencers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove influencer");
    }
  };

  const handleDeleteAll = async () => {
    const ok = await confirm({
      title: "Delete all influencers?",
      description: "This will permanently remove all discovered influencers.",
      confirmLabel: "Delete All",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      const count = await invoke<number>("delete_all_influencers");
      toast.success(`Deleted ${count} influencer${count === 1 ? "" : "s"}`);
      await loadInfluencers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete influencers");
    }
  };

  const handleExport = async () => {
    try {
      const csvContent = await invoke<string>("export_influencers_csv");
      downloadCsv(csvContent, `influencers-${new Date().toISOString().split("T")[0]}.csv`);
      toast.success("CSV exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export influencers");
    }
  };

  // Derive unique brand names for filter dropdown
  const allBrandNames = [...new Set(influencers.flatMap((i) => i.brandNames))].sort();

  const filteredInfluencers = brandFilter === "all"
    ? influencers
    : brandFilter === "none"
      ? influencers.filter((i) => i.brandNames.length === 0)
      : influencers.filter((i) => i.brandNames.includes(brandFilter));

  if (isLoading) {
    return (
      <PageLayout title="Influencers" subtitle="Discover influential Reddit users">
        <LoadingSkeleton rows={5} columns={5} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Influencers"
      subtitle="Discover influential Reddit users in your market"
      action={{
        label: isDiscovering ? "Discovering..." : "Scan Influencers",
        onClick: handleDiscover,
      }}
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {lastDiscovery && (
        <div className="mb-4 rounded-lg border border-primary/50 bg-primary/10 p-3">
          <p className="text-sm text-primary">
            Discovered {lastDiscovery.discovered.length} users, saved {lastDiscovery.savedCount} influencers
          </p>
        </div>
      )}

      {influencers.length === 0 ? (
        <EmptyState
          icon={<IconSpy className="h-8 w-8 text-muted-foreground" />}
          title="No influencers discovered"
          description="Run brand analyses first, then scan to find high-karma Reddit users who frequently discuss your brands."
          actionLabel={isDiscovering ? "Scanning..." : "Start Discovery"}
          onAction={handleDiscover}
          secondaryAction={
            <Link to="/brands" className="text-sm text-primary hover:underline">
              Go to Brands
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard title="Total Influencers" value={filteredInfluencers.length} icon={IconUsers} />
            <StatCard
              title="Mega/Macro Tier"
              value={filteredInfluencers.filter((i) => i.tier === "mega" || i.tier === "macro").length}
              icon={IconTrendingUp}
            />
            <StatCard
              title="Avg. Score"
              value={filteredInfluencers.length > 0 ? Math.round(filteredInfluencers.reduce((sum, i) => sum + i.avgScore, 0) / filteredInfluencers.length) : 0}
              icon={IconTrendingUp}
            />
            <StatCard
              title="Total Posts"
              value={filteredInfluencers.reduce((sum, i) => sum + i.postCount, 0)}
              icon={IconMessage}
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Discovered Influencers</CardTitle>
              <div className="flex items-center gap-2">
                {allBrandNames.length > 0 && (
                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <IconFilter className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Filter brand..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      <SelectItem value="none">No Brand</SelectItem>
                      {allBrandNames.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDeleteAll}
                >
                  <IconTrash className="h-4 w-4" />
                  Delete All
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <IconDownload className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Brands</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Tier</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Avg Score</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Posts</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Subreddits</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInfluencers.map((influencer) => (
                      <InfluencerRow
                        key={influencer.id}
                        influencer={influencer}
                        onRemove={() => handleRemove(influencer.id, influencer.username)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </PageLayout>
  );
}

function InfluencerRow({ influencer, onRemove }: { influencer: InfluencerWithAuthor; onRemove: () => void }) {
  const tier = TIER_CONFIG[influencer.tier] || TIER_CONFIG.nano;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <IconSpy className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <a
              href={`https://reddit.com/user/${influencer.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-primary flex items-center gap-1"
            >
              u/{influencer.username}
              <IconExternalLink className="h-3 w-3" />
            </a>
            <p className="text-sm text-muted-foreground">{influencer.totalKarma.toLocaleString()} karma</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-center">
        <div className="flex flex-wrap gap-1 justify-center">
          {influencer.brandNames.length > 0 ? (
            influencer.brandNames.map((name) => (
              <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-center">
        <Badge variant={tier.variant}>{tier.label}</Badge>
      </td>
      <td className="py-3 px-4 text-center">
        <span className={cn("font-semibold", influencer.avgScore >= 100 ? "text-positive" : "")}>
          {Math.round(influencer.avgScore).toLocaleString()}
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm">{influencer.postCount}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <div className="flex flex-wrap gap-1 justify-center">
          {influencer.expertiseTags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">r/{tag}</Badge>
          ))}
          {influencer.expertiseTags.length > 3 && (
            <Badge variant="outline" className="text-xs">+{influencer.expertiseTags.length - 3}</Badge>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove ${influencer.username}`}
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: typeof IconUsers }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-semibold">{value.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
