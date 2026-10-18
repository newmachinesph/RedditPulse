import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { useSettingsStore, useBrandsStore } from "@/lib/store";
import {
  IconActivity,
  IconArrowRight,
  IconKey,
  IconRocket,
  IconSparkles,
  IconLoader2,
} from "@tabler/icons-react";

const STEPS = [
  { label: "Welcome", description: "Get started with RedditPulse" },
  { label: "API Keys", description: "Connect your services" },
  { label: "First Brand", description: "Start tracking a brand" },
];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all ${
            i < current
              ? "w-8 bg-primary"
              : i === current
                ? "w-8 bg-primary/60"
                : "w-2 bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

export function OnboardingFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const { createBrand } = useBrandsStore();
  const {
    settings,
    updateSerperApiKey,
    updateOpenaiApiKey,
    updateClaudeApiKey,
    updateAiProvider,
    saveSettings,
  } = useSettingsStore();

  // Brand form state
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [isAutofilling, setIsAutofilling] = useState(false);

  const hasSerperKey = settings.serperApiKey.length > 0;
  const hasAiKey =
    settings.openaiApiKey.length > 0 || settings.claudeApiKey.length > 0;
  const canProceed = hasSerperKey && hasAiKey;

  const handleSaveKeys = async () => {
    if (!hasSerperKey) {
      toast.error("Serper API key is required for Reddit search");
      return;
    }
    if (!hasAiKey) {
      toast.error("Enter at least one AI provider key (OpenAI or Claude)");
      return;
    }
    await saveSettings();
    toast.success("API keys saved");
    setStep(2);
  };

  const handleAutofill = async () => {
    if (!brandName.trim()) {
      toast.error("Enter a brand name first");
      return;
    }
    setIsAutofilling(true);
    try {
      const result = await invoke<{ industry: string; description: string }>(
        "autofill_brand",
        { brandName: brandName.trim() }
      );
      setIndustry(result.industry);
      setDescription(result.description);
      toast.success("Fields auto-filled by AI");
    } catch (e) {
      toast.error(typeof e === "string" ? e : "AI autofill failed");
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleCreateBrand = async () => {
    if (!brandName.trim()) {
      toast.error("Brand name is required");
      return;
    }
    try {
      await createBrand({
        name: brandName.trim(),
        industry: industry || "General",
        description: description || undefined,
        website: website || undefined,
      });
      toast.success("Brand created! Welcome to RedditPulse.");
      navigate("/brands");
    } catch {
      toast.error("Failed to create brand");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <StepIndicator current={step} total={STEPS.length} />

        {/* Step 0: Welcome */}
        {step === 0 && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                  <IconActivity className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Welcome to RedditPulse</h1>
                <p className="text-muted-foreground mt-2">
                  Monitor your brand's presence and sentiment across Reddit
                  communities.
                </p>
              </div>
              <div className="text-left space-y-3 text-sm">
                <div className="flex gap-3 items-start">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                    1
                  </span>
                  <span className="text-muted-foreground">
                    Configure API keys for Reddit search and AI analysis
                  </span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                    2
                  </span>
                  <span className="text-muted-foreground">
                    Add brands you want to track on Reddit
                  </span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                    3
                  </span>
                  <span className="text-muted-foreground">
                    Run analyses to discover mentions, sentiment, influencers,
                    and audiences
                  </span>
                </div>
              </div>
              <Button onClick={() => setStep(1)} className="w-full">
                Get Started
                <IconArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: API Keys */}
        {step === 1 && (
          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                  <IconKey className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Connect Services</h2>
                  <p className="text-sm text-muted-foreground">
                    Serper + one AI provider required
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Serper API Key{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="password"
                    value={settings.serperApiKey}
                    onChange={(e) => updateSerperApiKey(e.target.value)}
                    placeholder="Enter your Serper API key"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for searching Reddit content via Google.{" "}
                    <a
                      href="https://serper.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Get key
                    </a>
                  </p>
                </div>

                <div className="border-t border-border pt-4">
                  <label className="text-sm font-medium">AI Provider</label>
                  <Select
                    value={settings.aiProvider}
                    onValueChange={(value: "openai" | "claude") =>
                      updateAiProvider(value)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI (GPT-5.1)</SelectItem>
                      <SelectItem value="claude">Claude (Sonnet)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    OpenAI API Key
                    {settings.aiProvider === "openai" && (
                      <span className="text-destructive"> *</span>
                    )}
                  </label>
                  <Input
                    type="password"
                    value={settings.openaiApiKey}
                    onChange={(e) => updateOpenaiApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Claude API Key
                    {settings.aiProvider === "claude" && (
                      <span className="text-destructive"> *</span>
                    )}
                  </label>
                  <Input
                    type="password"
                    value={settings.claudeApiKey}
                    onChange={(e) => updateClaudeApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="mt-1"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Keys are stored locally on your device. You can update them
                anytime in Settings.
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button
                  onClick={handleSaveKeys}
                  disabled={!canProceed}
                  className="flex-1"
                >
                  Save & Continue
                  <IconArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: First Brand */}
        {step === 2 && (
          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                  <IconRocket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    Create Your First Brand
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your brand name, then let AI fill the rest
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Brand Name <span className="text-destructive">*</span>
                  </label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="My Company"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutofill}
                      disabled={!brandName.trim() || isAutofilling}
                      className="shrink-0 h-9"
                    >
                      {isAutofilling ? (
                        <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <IconSparkles className="h-4 w-4 mr-1" />
                      )}
                      {isAutofilling ? "Filling..." : "AI Fill"}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Industry</label>
                  <Input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. SaaS, E-commerce, Healthcare"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Website</label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://www.example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the brand"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={handleCreateBrand}
                  disabled={!brandName.trim()}
                  className="flex-1"
                >
                  <IconRocket className="h-4 w-4 mr-2" />
                  Create Brand & Start
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
