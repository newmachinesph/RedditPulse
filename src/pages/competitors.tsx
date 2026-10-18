import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  IconChartBar,
  IconPlus,
  IconLoader2,
  IconTrash,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconBuildingStore,
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
import { cn, getSentimentColor } from "@/lib/utils";
import { safeJsonParse } from "@/lib/safe-parse";
import { useConfirm } from "@/lib/hooks";
import type { Brand, CompetitorWithBrand, SavedAnalysisRecord, BrandAnalysisResult, BrandWithAnalysis } from "@/lib/types";

export function CompetitorsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorWithBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [comparisonData, setComparisonData] = useState<Map<string, BrandWithAnalysis>>(new Map());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [brandsResult, competitorsResult] = await Promise.all([
        invoke<Brand[]>("get_all_brands"),
        invoke<CompetitorWithBrand[]>("get_all_competitors"),
      ]);
      setBrands(brandsResult);
      setCompetitors(competitorsResult);

      const brandIds = new Set<string>();
      competitorsResult.forEach((c) => { brandIds.add(c.brandId); brandIds.add(c.competitorBrandId); });

      const analysisMap = new Map<string, BrandWithAnalysis>();
      for (const brandId of brandIds) {
        const brand = brandsResult.find((b) => b.id === brandId);
        if (brand) {
          try {
            const savedAnalysis = await invoke<SavedAnalysisRecord | null>("get_latest_brand_analysis", { brandId });
            if (savedAnalysis) {
              const analysis = safeJsonParse<BrandAnalysisResult | null>(savedAnalysis.analysisData, null);
              analysisMap.set(brandId, { brand, analysis, postCount: savedAnalysis.postCount });
            } else {
              analysisMap.set(brandId, { brand, analysis: null, postCount: 0 });
            }
          } catch {
            analysisMap.set(brandId, { brand, analysis: null, postCount: 0 });
          }
        }
      }
      setComparisonData(analysisMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!selectedBrandId || !selectedCompetitorId) return;
    setIsAdding(true);
    try {
      await invoke("add_competitor", { input: { brandId: selectedBrandId, competitorBrandId: selectedCompetitorId } });
      setShowAddForm(false);
      setSelectedBrandId("");
      setSelectedCompetitorId("");
      toast.success("Competitor added");
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add competitor");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveCompetitor = async (id: string, name: string) => {
    const ok = await confirm({ title: "Remove competitor?", description: `This will remove "${name}" from your competitor comparisons.`, confirmLabel: "Remove", variant: "destructive" });
    if (!ok) return;
    try {
      await invoke("remove_competitor", { id });
      toast.success("Competitor removed");
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove competitor");
    }
  };

  const competitorsByBrand = competitors.reduce((acc, comp) => {
    if (!acc[comp.brandId]) acc[comp.brandId] = [];
    acc[comp.brandId].push(comp);
    return acc;
  }, {} as Record<string, CompetitorWithBrand[]>);

  if (isLoading) {
    return (<PageLayout title="Competitors" subtitle="Compare brand sentiment"><LoadingSkeleton rows={4} columns={5} /></PageLayout>);
  }

  return (
    <PageLayout title="Competitors" subtitle="Compare brand sentiment and share of voice" action={{ label: "Add Comparison", onClick: () => setShowAddForm(true) }}>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {showAddForm && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Add Competitor Comparison</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1.5 block">Your Brand</label>
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                  <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>{brands.map((brand) => (<SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1.5 block">Competitor</label>
                <Select value={selectedCompetitorId} onValueChange={setSelectedCompetitorId}>
                  <SelectTrigger><SelectValue placeholder="Select competitor" /></SelectTrigger>
                  <SelectContent>{brands.filter((b) => b.id !== selectedBrandId).map((brand) => (<SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddCompetitor} disabled={!selectedBrandId || !selectedCompetitorId || isAdding}>
                  {isAdding ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconPlus className="h-4 w-4" />}Add
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </div>
            </div>
            {brands.length < 2 && (
              <p className="mt-3 text-sm text-muted-foreground">You need at least 2 brands to create a comparison. <Link to="/brands" className="text-primary hover:underline">Add more brands</Link></p>
            )}
          </CardContent>
        </Card>
      )}

      {Object.keys(competitorsByBrand).length === 0 ? (
        <EmptyState
          icon={<IconChartBar className="h-8 w-8 text-muted-foreground" />}
          title="No competitor analysis"
          description="Track competitors alongside your brands. Compare sentiment, share of voice, and market positioning on Reddit."
          actionLabel="Set Up Comparison"
          onAction={() => setShowAddForm(true)}
          secondaryAction={brands.length < 2 ? <Link to="/brands" className="text-sm text-primary hover:underline">You need at least 2 brands. Go to Brands</Link> : undefined}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(competitorsByBrand).map(([brandId, comps]) => {
            const brandData = comparisonData.get(brandId);
            if (!brandData) return null;
            return (
              <Card key={brandId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><IconBuildingStore className="h-5 w-5 text-primary" /></div>
                      <div>
                        <CardTitle>{brandData.brand.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">vs {comps.length} competitor{comps.length > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <Link to={`/brands/${brandId}`}><Button variant="outline" size="sm">View Brand</Button></Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Brand</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Sentiment</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Score</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Posts</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Comparison</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <BrandComparisonRow data={brandData} isMainBrand baseScore={brandData.analysis?.overallSentiment.score ?? null} />
                        {comps.map((comp) => {
                          const competitorData = comparisonData.get(comp.competitorBrandId);
                          if (!competitorData) return null;
                          return <BrandComparisonRow key={comp.id} data={competitorData} baseScore={brandData.analysis?.overallSentiment.score ?? null} onRemove={() => handleRemoveCompetitor(comp.id, competitorData.brand.name)} />;
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </PageLayout>
  );
}

function BrandComparisonRow({ data, isMainBrand, baseScore, onRemove }: { data: BrandWithAnalysis; isMainBrand?: boolean; baseScore: number | null; onRemove?: () => void }) {
  const score = data.analysis?.overallSentiment.score ?? null;
  const diff = score !== null && baseScore !== null ? score - baseScore : null;

  return (
    <tr className={cn("border-b border-border last:border-0", isMainBrand && "bg-primary/5")}>
      <td className="py-3 px-4">
        <Link to={`/brands/${data.brand.id}`} className="font-medium hover:text-primary">
          {data.brand.name}
          {isMainBrand && <Badge variant="secondary" className="ml-2 text-xs">Primary</Badge>}
        </Link>
        <p className="text-sm text-muted-foreground">{data.brand.industry}</p>
      </td>
      <td className="py-3 px-4 text-center">
        {data.analysis ? (
          <Badge variant={score !== null && score >= 0.5 ? "positive" : score !== null && score >= -0.5 ? "neutral" : "negative"}>{data.analysis.overallSentiment.label}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Not analyzed</span>
        )}
      </td>
      <td className="py-3 px-4 text-center">
        {score !== null ? (
          <span className={cn("font-semibold", getSentimentColor(score))}>{score >= 0 ? "+" : ""}{score.toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="py-3 px-4 text-center"><span className="text-sm">{data.postCount || "-"}</span></td>
      <td className="py-3 px-4 text-center">
        {isMainBrand ? (
          <span className="text-sm text-muted-foreground">Baseline</span>
        ) : diff !== null ? (
          <div className="flex items-center justify-center gap-1">
            {diff > 0.1 ? <IconTrendingUp className="h-4 w-4 text-positive" /> : diff < -0.1 ? <IconTrendingDown className="h-4 w-4 text-negative" /> : <IconMinus className="h-4 w-4 text-muted-foreground" />}
            <span className={cn("text-sm font-medium", diff > 0.1 ? "text-positive" : diff < -0.1 ? "text-negative" : "text-muted-foreground")}>{diff > 0 ? "+" : ""}{diff.toFixed(2)}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        {!isMainBrand && onRemove && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={`Remove ${data.brand.name}`}>
            <IconTrash className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}
