import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  IconBuildingStore,
  IconSearch,
  IconTrash,
  IconEdit,
  IconAnalyze,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout";
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  ConfirmDialog,
  EmptyState,
  LoadingSkeleton,
  ErrorBanner,
} from "@/components/ui";
import { useBrandsStore } from "@/lib/store";
import { formatRelativeTime } from "@/lib/utils";
import { brandSchema } from "@/lib/schemas";
import { useConfirm } from "@/lib/hooks";
import type { Brand, AnalysisSummary } from "@/lib/types";

export function BrandsListPage() {
  const navigate = useNavigate();
  const { brands, isLoading, error, loadBrands, createBrand, updateBrand, deleteBrandById } = useBrandsStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newBrand, setNewBrand] = useState({ name: "", industry: "", description: "" });
  const [editBrandData, setEditBrandData] = useState({ name: "", industry: "", description: "" });
  const [analysisSummaries, setAnalysisSummaries] = useState<Map<string, AnalysisSummary>>(new Map());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isAutofilling, setIsAutofilling] = useState(false);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

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
    loadAnalysisSummaries();
  }, [loadBrands, loadAnalysisSummaries]);

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.industry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAutofill = async () => {
    if (!newBrand.name.trim()) {
      toast.error("Enter a brand name first");
      return;
    }
    setIsAutofilling(true);
    try {
      const result = await invoke<{ industry: string; description: string }>("autofill_brand", { brandName: newBrand.name.trim() });
      setNewBrand((prev) => ({ ...prev, industry: result.industry, description: result.description }));
      toast.success("Auto-filled brand details");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleAddBrand = async () => {
    const result = brandSchema.safeParse(newBrand);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[issue.path.map(String).join(".")] = issue.message;
      }
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createBrand({ name: newBrand.name, industry: newBrand.industry, description: newBrand.description || undefined });
      setNewBrand({ name: "", industry: "", description: "" });
      setIsAddDialogOpen(false);
      toast.success("Brand created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create brand");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setEditBrandData({ name: brand.name, industry: brand.industry, description: brand.description || "" });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingBrand) return;
    const result = brandSchema.safeParse(editBrandData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[`edit.${issue.path.map(String).join(".")}`] = issue.message;
      }
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateBrand(editingBrand.id, { name: editBrandData.name, industry: editBrandData.industry, description: editBrandData.description || undefined });
      setIsEditDialogOpen(false);
      setEditingBrand(null);
      toast.success("Brand updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update brand");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBrand = async (id: string, name: string) => {
    const ok = await confirm({ title: "Delete brand?", description: `This will permanently delete "${name}" and all its analyses, mentions, and related data.`, confirmLabel: "Delete", variant: "destructive" });
    if (!ok) return;
    try {
      await deleteBrandById(id);
      toast.success("Brand deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete brand");
    }
  };

  return (
    <PageLayout title="Brands" subtitle="Manage and analyze your tracked brands" action={{ label: "Add Brand", onClick: () => setIsAddDialogOpen(true) }}>
      <div className="mb-6">
        <div className="relative max-w-md">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search brands..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      <ErrorBanner error={error} />

      {isLoading ? (
        <LoadingSkeleton rows={6} variant="cards" />
      ) : filteredBrands.length === 0 ? (
        <EmptyState
          icon={<IconBuildingStore className="h-8 w-8 text-muted-foreground" />}
          title="No brands yet"
          description="Add your first brand to start tracking sentiment"
          actionLabel="Add Brand"
          onAction={() => setIsAddDialogOpen(true)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBrands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} analysisSummary={analysisSummaries.get(brand.id)} onAnalyze={() => navigate(`/brands/${brand.id}`)} onEdit={() => handleEditBrand(brand)} onDelete={() => handleDeleteBrand(brand.id, brand.name)} />
          ))}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Brand</DialogTitle><DialogDescription>Enter the details of the brand you want to track.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand Name</label>
              <div className="flex gap-2">
                <Input placeholder="e.g., Tesla, Apple, Nike" value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} />
                <Button variant="outline" size="icon" onClick={handleAutofill} disabled={isAutofilling || !newBrand.name.trim()} title="Auto-fill with AI">
                  {isAutofilling ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconSparkles className="h-4 w-4" />}
                </Button>
              </div>
              {formErrors["name"] && <p className="text-xs text-destructive">{formErrors["name"]}</p>}
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Industry</label><Input placeholder="e.g., Technology, Automotive, Retail" value={newBrand.industry} onChange={(e) => setNewBrand({ ...newBrand, industry: e.target.value })} />{formErrors["industry"] && <p className="text-xs text-destructive">{formErrors["industry"]}</p>}</div>
            <div className="space-y-2"><label className="text-sm font-medium">Description (optional)</label><Input placeholder="Brief description of the brand" value={newBrand.description} onChange={(e) => setNewBrand({ ...newBrand, description: e.target.value })} />{formErrors["description"] && <p className="text-xs text-destructive">{formErrors["description"]}</p>}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleAddBrand} disabled={isSubmitting}>
              {isSubmitting ? (<><IconLoader2 className="h-4 w-4 animate-spin" />Adding...</>) : "Add Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Brand</DialogTitle><DialogDescription>Update the brand details below.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><label className="text-sm font-medium">Brand Name</label><Input placeholder="e.g., Tesla, Apple, Nike" value={editBrandData.name} onChange={(e) => setEditBrandData({ ...editBrandData, name: e.target.value })} />{formErrors["edit.name"] && <p className="text-xs text-destructive">{formErrors["edit.name"]}</p>}</div>
            <div className="space-y-2"><label className="text-sm font-medium">Industry</label><Input placeholder="e.g., Technology, Automotive, Retail" value={editBrandData.industry} onChange={(e) => setEditBrandData({ ...editBrandData, industry: e.target.value })} />{formErrors["edit.industry"] && <p className="text-xs text-destructive">{formErrors["edit.industry"]}</p>}</div>
            <div className="space-y-2"><label className="text-sm font-medium">Description (optional)</label><Input placeholder="Brief description of the brand" value={editBrandData.description} onChange={(e) => setEditBrandData({ ...editBrandData, description: e.target.value })} />{formErrors["edit.description"] && <p className="text-xs text-destructive">{formErrors["edit.description"]}</p>}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting}>
              {isSubmitting ? (<><IconLoader2 className="h-4 w-4 animate-spin" />Saving...</>) : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </PageLayout>
  );
}

function BrandCard({ brand, analysisSummary, onAnalyze, onEdit, onDelete }: { brand: Brand; analysisSummary?: AnalysisSummary; onAnalyze: () => void; onEdit: () => void; onDelete: () => void }) {
  const getSentimentBadgeVariant = (label: string): "positive" | "negative" | "secondary" => {
    const l = label.toLowerCase();
    if (l === "positive") return "positive";
    if (l === "negative") return "negative";
    return "secondary";
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:border-primary/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><IconBuildingStore className="h-5 w-5 text-primary" /></div>
            <div>
              <Link to={`/brands/${brand.id}`} className="font-medium hover:text-primary">{brand.name}</Link>
              <p className="text-sm text-muted-foreground">{brand.industry}</p>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAnalyze} aria-label="Analyze brand"><IconAnalyze className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Edit brand"><IconEdit className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} aria-label="Delete brand"><IconTrash className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          {analysisSummary ? (
            <><Badge variant={getSentimentBadgeVariant(analysisSummary.overallSentimentLabel)}>{analysisSummary.overallSentimentLabel}</Badge><span className="text-sm text-muted-foreground">{analysisSummary.postCount} posts analyzed</span></>
          ) : (
            <Badge variant="outline">Not analyzed</Badge>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
          {analysisSummary ? <>Analyzed {formatRelativeTime(analysisSummary.lastAnalyzedAt)}</> : <>Updated {formatRelativeTime(brand.updatedAt)}</>}
        </div>
      </CardContent>
    </Card>
  );
}
