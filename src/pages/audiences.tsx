import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  IconUsers,
  IconPlus,
  IconLoader2,
  IconTrash,
  IconRefresh,
  IconExternalLink,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconEdit,
  IconSparkles,
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
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { cn, formatRelativeTime, downloadCsv } from "@/lib/utils";
import { TIER_OPTIONS } from "@/lib/constants";
import { audienceSchema } from "@/lib/schemas";
import { useConfirm } from "@/lib/hooks";
import type { AudienceWithFilters, AudienceMember, Brand } from "@/lib/types";

export function AudiencesPage() {
  const [audiences, setAudiences] = useState<AudienceWithFilters[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [brands, setBrands] = useState<Brand[]>([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [minKarma, setMinKarma] = useState("");
  const [minPosts, setMinPosts] = useState("");
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [isAutofilling, setIsAutofilling] = useState(false);

  const [expandedAudienceId, setExpandedAudienceId] = useState<string | null>(null);
  const [members, setMembers] = useState<AudienceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [editingAudience, setEditingAudience] = useState<AudienceWithFilters | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBrandId, setEditBrandId] = useState<string>("");
  const [editMinKarma, setEditMinKarma] = useState("");
  const [editMinPosts, setEditMinPosts] = useState("");
  const [editSelectedTiers, setEditSelectedTiers] = useState<string[]>([]);

  const [membersPage, setMembersPage] = useState(0);
  const membersPerPage = 10;

  useEffect(() => {
    loadAudiences();
    invoke<Brand[]>("get_all_brands").then(setBrands).catch(() => {});
  }, []);

  const loadAudiences = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<AudienceWithFilters[]>("get_audiences");
      setAudiences(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audiences");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    const result = audienceSchema.safeParse({
      name: newName,
      description: newDescription || undefined,
      filters: {
        subreddits: [],
        minKarma: minKarma ? parseInt(minKarma) : null,
        minPosts: minPosts ? parseInt(minPosts) : null,
        tiers: selectedTiers,
      },
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[issue.path.map(String).join(".")] = issue.message;
      }
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setIsCreating(true);
    setError(null);
    try {
      await invoke("create_audience_cmd", {
        input: {
          name: newName.trim(),
          description: newDescription.trim() || null,
          brandId: selectedBrandId && selectedBrandId !== "none" ? selectedBrandId : null,
          filters: {
            subreddits: [],
            minKarma: minKarma ? parseInt(minKarma) : null,
            minPosts: minPosts ? parseInt(minPosts) : null,
            tiers: selectedTiers,
          },
        },
      });
      setNewName("");
      setNewDescription("");
      setSelectedBrandId("");
      setMinKarma("");
      setMinPosts("");
      setSelectedTiers([]);
      setShowCreateForm(false);
      toast.success("Audience created");
      await loadAudiences();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create audience");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAutofill = async () => {
    setIsAutofilling(true);
    try {
      const brandName = selectedBrandId && selectedBrandId !== "none"
        ? brands.find((b) => b.id === selectedBrandId)?.name ?? null
        : null;
      const result = await invoke<{
        name: string;
        description: string;
        minKarma: number | null;
        minPosts: number | null;
        tiers: string[];
      }>("autofill_audience", { brandName });
      setNewName(result.name);
      setNewDescription(result.description);
      if (result.minKarma != null) setMinKarma(result.minKarma.toString());
      if (result.minPosts != null) setMinPosts(result.minPosts.toString());
      if (result.tiers.length > 0) setSelectedTiers(result.tiers);
      toast.success("Auto-filled audience details");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: "Delete audience?",
      description: `This will permanently delete "${name}" and remove all its members.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await invoke("delete_audience_cmd", { id });
      toast.success("Audience deleted");
      await loadAudiences();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete audience");
    }
  };

  const handleEdit = (audience: AudienceWithFilters) => {
    setEditingAudience(audience);
    setEditName(audience.name);
    setEditDescription(audience.description || "");
    setEditBrandId(audience.brandId || "");
    setEditMinKarma(audience.filters.minKarma?.toString() || "");
    setEditMinPosts(audience.filters.minPosts?.toString() || "");
    setEditSelectedTiers(audience.filters.tiers || []);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAudience) return;
    const result = audienceSchema.safeParse({
      name: editName,
      description: editDescription || undefined,
      filters: {
        subreddits: [],
        minKarma: editMinKarma ? parseInt(editMinKarma) : null,
        minPosts: editMinPosts ? parseInt(editMinPosts) : null,
        tiers: editSelectedTiers,
      },
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[`edit.${issue.path.map(String).join(".")}`] = issue.message;
      }
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setIsUpdating(true);
    setError(null);
    try {
      await invoke("update_audience_cmd", {
        id: editingAudience.id,
        input: {
          name: editName.trim(),
          description: editDescription.trim() || null,
          brandId: editBrandId && editBrandId !== "none" ? editBrandId : null,
          filters: {
            subreddits: [],
            minKarma: editMinKarma ? parseInt(editMinKarma) : null,
            minPosts: editMinPosts ? parseInt(editMinPosts) : null,
            tiers: editSelectedTiers,
          },
        },
      });
      setIsEditDialogOpen(false);
      setEditingAudience(null);
      toast.success("Audience updated");
      await loadAudiences();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update audience");
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleEditTier = (tier: string) => {
    setEditSelectedTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    );
  };

  const handleRefresh = async (id: string) => {
    try {
      await invoke("refresh_audience", { id });
      toast.success("Audience refreshed");
      await loadAudiences();
      if (expandedAudienceId === id) {
        await loadMembers(id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to refresh audience");
    }
  };

  const loadMembers = async (audienceId: string) => {
    setLoadingMembers(true);
    try {
      const result = await invoke<AudienceMember[]>("get_audience_members_cmd", { audienceId });
      setMembers(result);
    } catch (e) {
      toast.error("Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleExpand = async (audienceId: string) => {
    if (expandedAudienceId === audienceId) {
      setExpandedAudienceId(null);
      setMembers([]);
    } else {
      setExpandedAudienceId(audienceId);
      setMembersPage(0);
      await loadMembers(audienceId);
    }
  };

  const toggleTier = (tier: string) => {
    setSelectedTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    );
  };

  const handleExportAudience = async (audienceId: string, audienceName: string) => {
    try {
      const csvContent = await invoke<string>("export_audience_csv", { audienceId });
      downloadCsv(csvContent, `audience-${audienceName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`);
      toast.success("CSV exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export audience");
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Audiences" subtitle="Build audience panels">
        <LoadingSkeleton rows={3} columns={4} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Audiences"
      subtitle="Build and analyze Reddit audience panels"
      action={{ label: "Build Audience", onClick: () => setShowCreateForm(true) }}
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create New Audience</CardTitle>
              <Button variant="outline" size="sm" onClick={handleAutofill} disabled={isAutofilling} title="Auto-fill with AI">
                {isAutofilling ? <IconLoader2 className="h-4 w-4 animate-spin mr-1" /> : <IconSparkles className="h-4 w-4 mr-1" />}
                {isAutofilling ? "Filling..." : "Auto-fill"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="text-sm font-medium">Audience Name</label>
                  <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Tech Enthusiasts" />
                  {formErrors["name"] && <p className="text-xs text-destructive">{formErrors["name"]}</p>}
                </div>
                <div>
                  <label htmlFor="description" className="text-sm font-medium">Description (optional)</label>
                  <Input id="description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Brief description" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Brand (optional)</label>
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select a brand..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No brand</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="minKarma" className="text-sm font-medium">Minimum Karma</label>
                  <Input id="minKarma" type="number" value={minKarma} onChange={(e) => setMinKarma(e.target.value)} placeholder="e.g., 100" />
                </div>
                <div>
                  <label htmlFor="minPosts" className="text-sm font-medium">Minimum Posts</label>
                  <Input id="minPosts" type="number" value={minPosts} onChange={(e) => setMinPosts(e.target.value)} placeholder="e.g., 2" />
                </div>
              </div>
              <div>
                <span className="text-sm font-medium">Influencer Tiers</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {TIER_OPTIONS.map((tier) => (
                    <label key={tier.value} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors", selectedTiers.includes(tier.value) ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                      <input type="checkbox" checked={selectedTiers.includes(tier.value)} onChange={() => toggleTier(tier.value)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                      <span className="text-sm">{tier.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Leave empty to include all tiers</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Members are automatically discovered from your brand analyses. Make sure you've analyzed at least one brand before creating an audience.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={!newName.trim() || isCreating}>
                  {isCreating ? (<><IconLoader2 className="h-4 w-4 animate-spin" />Creating...</>) : (<><IconPlus className="h-4 w-4" />Create Audience</>)}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {audiences.length === 0 ? (
        <EmptyState
          icon={<IconUsers className="h-8 w-8 text-muted-foreground" />}
          title="No audiences yet"
          description="Build audience panels from Reddit users who discuss your brands."
          secondaryText="Tip: First analyze at least one brand. The system will automatically find users from your analysis results."
          actionLabel="Build First Audience"
          onAction={() => setShowCreateForm(true)}
          secondaryAction={<Link to="/brands" className="text-sm text-primary hover:underline">Go to Brands</Link>}
        />
      ) : (
        <div className="space-y-4">
          {audiences.map((audience) => (
            <Card key={audience.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleExpand(audience.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && toggleExpand(audience.id)} aria-expanded={expandedAudienceId === audience.id}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><IconUsers className="h-5 w-5 text-primary" /></div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {audience.name}
                        <Badge variant="secondary">{audience.memberCount} members</Badge>
                        {audience.brandId && brands.find((b) => b.id === audience.brandId) && (
                          <Badge variant="outline">{brands.find((b) => b.id === audience.brandId)!.name}</Badge>
                        )}
                      </CardTitle>
                      {audience.description && <p className="text-sm text-muted-foreground">{audience.description}</p>}
                    </div>
                    {expandedAudienceId === audience.id ? <IconChevronUp className="h-5 w-5 text-muted-foreground ml-auto" /> : <IconChevronDown className="h-5 w-5 text-muted-foreground ml-auto" />}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExportAudience(audience.id, audience.name)} aria-label="Export to CSV"><IconDownload className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRefresh(audience.id)} aria-label="Refresh members"><IconRefresh className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(audience)} aria-label="Edit audience"><IconEdit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(audience.id, audience.name)} aria-label="Delete audience"><IconTrash className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {audience.filters.minKarma != null && <span>Min karma: {audience.filters.minKarma}</span>}
                  {audience.filters.minPosts != null && <span>Min posts: {audience.filters.minPosts}</span>}
                  {audience.filters.tiers.length > 0 && <span>Tiers: {audience.filters.tiers.join(", ")}</span>}
                  <span className="ml-auto">Created {formatRelativeTime(audience.createdAt)}</span>
                </div>
              </CardContent>
              {expandedAudienceId === audience.id && (
                <CardContent className="border-t border-border pt-4">
                  {loadingMembers ? (
                    <LoadingSkeleton rows={3} columns={4} />
                  ) : members.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No members found matching your filters.</p>
                      <p className="text-xs text-muted-foreground mt-2">Make sure you have run brand analyses first, then click the refresh button to find members.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">User</th>
                            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Karma</th>
                            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Avg Score</th>
                            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Posts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.slice(membersPage * membersPerPage, (membersPage + 1) * membersPerPage).map((member) => (
                            <tr key={member.authorId} className="border-b border-border last:border-0">
                              <td className="py-2 px-3"><a href={`https://reddit.com/user/${member.username}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">u/{member.username}<IconExternalLink className="h-3 w-3" /></a></td>
                              <td className="py-2 px-3 text-center">{member.totalKarma.toLocaleString()}</td>
                              <td className="py-2 px-3 text-center">{Math.round(member.avgScore).toLocaleString()}</td>
                              <td className="py-2 px-3 text-center">{member.postCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {members.length > membersPerPage && (
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-xs text-muted-foreground">
                            Showing {membersPage * membersPerPage + 1}–{Math.min((membersPage + 1) * membersPerPage, members.length)} of {members.length} members
                          </p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={membersPage === 0} onClick={() => setMembersPage((p) => p - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={(membersPage + 1) * membersPerPage >= members.length} onClick={() => setMembersPage((p) => p + 1)}>Next</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Audience</DialogTitle><DialogDescription>Update the audience details and filters below.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="editName" className="text-sm font-medium">Audience Name</label><Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g., Tech Enthusiasts" />{formErrors["edit.name"] && <p className="text-xs text-destructive">{formErrors["edit.name"]}</p>}</div>
              <div><label htmlFor="editDescription" className="text-sm font-medium">Description (optional)</label><Input id="editDescription" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Brief description" /></div>
            </div>
            <div>
              <label className="text-sm font-medium">Brand (optional)</label>
              <Select value={editBrandId} onValueChange={setEditBrandId}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select a brand..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No brand</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="editMinKarma" className="text-sm font-medium">Minimum Karma</label><Input id="editMinKarma" type="number" value={editMinKarma} onChange={(e) => setEditMinKarma(e.target.value)} placeholder="e.g., 100" /></div>
              <div><label htmlFor="editMinPosts" className="text-sm font-medium">Minimum Posts</label><Input id="editMinPosts" type="number" value={editMinPosts} onChange={(e) => setEditMinPosts(e.target.value)} placeholder="e.g., 2" /></div>
            </div>
            <div>
              <span className="text-sm font-medium">Influencer Tiers</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {TIER_OPTIONS.map((tier) => (
                  <label key={tier.value} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors", editSelectedTiers.includes(tier.value) ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                    <input type="checkbox" checked={editSelectedTiers.includes(tier.value)} onChange={() => toggleEditTier(tier.value)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                    <span className="text-sm">{tier.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isUpdating}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || isUpdating}>
              {isUpdating ? (<><IconLoader2 className="h-4 w-4 animate-spin" />Saving...</>) : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </PageLayout>
  );
}
