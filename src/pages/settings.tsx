import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  IconKey,
  IconServer,
  IconSettings,
  IconAnalyze,
  IconLoader2,
  IconCheck,
  IconAlertCircle,
  IconAlertTriangle,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  ErrorBanner,
  ConfirmDialog,
} from "@/components/ui";
import { useSettingsStore, useBrandsStore } from "@/lib/store";
import { useConfirm } from "@/lib/hooks";
import { settingsAnalysisSchema, settingsJobsSchema } from "@/lib/schemas";

interface ProxyTestResponse {
  success: boolean;
  externalIp: string | null;
  error: string | null;
}

// Parse proxy string in format: host:port:username:password
function parseProxyString(proxyString: string): {
  server: string;
  username: string;
  password: string;
} | null {
  const trimmed = proxyString.trim();
  if (!trimmed) return null;

  // Split by colon, but handle the format carefully
  // Format: host:port:username:password
  const parts = trimmed.split(":");

  if (parts.length >= 4) {
    // host:port:username:password format
    const host = parts[0];
    const port = parts[1];
    const username = parts[2];
    // Password might contain colons, so join remaining parts
    const password = parts.slice(3).join(":");

    return {
      server: `${host}:${port}`,
      username,
      password,
    };
  } else if (parts.length === 2) {
    // Just host:port, no auth
    return {
      server: trimmed,
      username: "",
      password: "",
    };
  }

  return null;
}

export function SettingsPage() {
  const {
    settings,
    isInitialized,
    isLoading,
    isSaving,
    error,
    loadSettings,
    saveSettings,
    updateSerperApiKey,
    updateOpenaiApiKey,
    updateClaudeApiKey,
    updateAiProvider,
    updateProxy,
    updateAnalysis,
    updateJobs,
  } = useSettingsStore();

  const navigate = useNavigate();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [isResetting, setIsResetting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [testingProxy, setTestingProxy] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<"idle" | "success" | "error">("idle");
  const [proxyIp, setProxyIp] = useState<string | null>(null);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [proxyString, setProxyString] = useState("");
  const [proxyParseError, setProxyParseError] = useState<string | null>(null);

  const handleProxyStringPaste = (value: string) => {
    setProxyString(value);
    setProxyParseError(null);

    if (!value.trim()) return;

    const parsed = parseProxyString(value);
    if (parsed) {
      updateProxy({
        server: parsed.server,
        username: parsed.username,
        password: parsed.password,
      });
      setProxyString(""); // Clear after successful parse
    } else {
      setProxyParseError("Invalid format. Expected: host:port:username:password");
    }
  };

  useEffect(() => {
    if (!isInitialized) {
      loadSettings();
    }
  }, [isInitialized, loadSettings]);

  const handleSave = async () => {
    // Validate analysis settings
    const analysisResult = settingsAnalysisSchema.safeParse(settings.analysis);
    const jobsResult = settingsJobsSchema.safeParse(settings.jobs);
    const errors: Record<string, string> = {};

    if (!analysisResult.success) {
      for (const issue of analysisResult.error.issues) {
        errors[`analysis.${String(issue.path[0])}`] = issue.message;
      }
    }
    if (!jobsResult.success) {
      for (const issue of jobsResult.error.issues) {
        errors[`jobs.${String(issue.path[0])}`] = issue.message;
      }
    }

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix validation errors before saving");
      return;
    }

    await saveSettings();
    if (!useSettingsStore.getState().error) {
      toast.success("Settings saved");
    } else {
      toast.error(useSettingsStore.getState().error || "Failed to save settings");
    }
  };

  const testProxyConnection = async () => {
    // Save settings first so the backend has the latest proxy config
    await saveSettings();

    setTestingProxy(true);
    setProxyStatus("idle");
    setProxyIp(null);
    setProxyError(null);

    try {
      const result = await invoke<ProxyTestResponse>("test_proxy");
      if (result.success) {
        setProxyStatus("success");
        setProxyIp(result.externalIp);
        toast.success("Proxy connection successful");
      } else {
        setProxyStatus("error");
        setProxyError(result.error || "Connection failed");
        toast.error(result.error || "Proxy connection failed");
      }
    } catch (e) {
      setProxyStatus("error");
      setProxyError(e instanceof Error ? e.message : String(e));
      toast.error("Proxy test failed");
    } finally {
      setTestingProxy(false);
    }
  };

  const handleResetApplication = async () => {
    const confirmed = await confirm({
      title: "Reset Application",
      description:
        "This will permanently delete ALL brands, analyses, audiences, influencers, competitors, jobs, and reports. Your settings and API keys will be preserved. This action cannot be undone.",
      confirmLabel: "Reset Everything",
      variant: "destructive",
    });

    if (!confirmed) return;

    setIsResetting(true);
    try {
      await invoke("reset_application");
      // Clear frontend stores
      useBrandsStore.getState().loadBrands();
      toast.success("Application has been reset");
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading && !isInitialized) {
    return (
      <PageLayout title="Settings" subtitle="Configure your RedditPulse instance">
        <div className="flex items-center justify-center py-12">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Settings" subtitle="Configure your RedditPulse instance">
      <Tabs defaultValue="api" className="space-y-6">
        <TabsList>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="proxy">Proxy</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* API Keys */}
        <TabsContent value="api">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <IconAnalyze className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>AI Provider</CardTitle>
                    <CardDescription>
                      Choose which AI provider to use for brand analysis
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Select
                  value={settings.aiProvider}
                  onValueChange={(value: "openai" | "claude") => updateAiProvider(value)}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT-5.1)</SelectItem>
                    <SelectItem value="claude">Claude (Sonnet)</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <IconKey className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Serper API Key</CardTitle>
                    <CardDescription>
                      Required for searching Reddit content via Google
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    type="password"
                    placeholder="Enter your Serper API key"
                    value={settings.serperApiKey}
                    onChange={(e) => updateSerperApiKey(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your API key at{" "}
                    <a
                      href="https://serper.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      serper.dev
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <IconKey className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>OpenAI API Key</CardTitle>
                    <CardDescription>
                      Required when using OpenAI as the AI provider
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    type="password"
                    placeholder="Enter your OpenAI API key"
                    value={settings.openaiApiKey}
                    onChange={(e) => updateOpenaiApiKey(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your API key at{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      platform.openai.com
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <IconKey className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Claude API Key</CardTitle>
                    <CardDescription>
                      Required when using Claude as the AI provider
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    type="password"
                    placeholder="Enter your Anthropic API key"
                    value={settings.claudeApiKey}
                    onChange={(e) => updateClaudeApiKey(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your API key at{" "}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      console.anthropic.com
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Proxy Settings */}
        <TabsContent value="proxy">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <IconServer className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Proxy Configuration</CardTitle>
                    <CardDescription>
                      Configure proxies for Reddit data collection
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Enable Proxy</span>
                  <Switch
                    checked={settings.proxy.enabled}
                    onCheckedChange={(checked) => updateProxy({ enabled: checked })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className={settings.proxy.enabled ? "" : "opacity-50 pointer-events-none"}>
              <div className="space-y-4">
                {/* Quick Paste Input */}
                <div className="space-y-2 pb-4 border-b border-border">
                  <label className="text-sm font-medium">Quick Paste (Proxy String)</label>
                  <Input
                    placeholder="host:port:username:password"
                    value={proxyString}
                    onChange={(e) => handleProxyStringPaste(e.target.value)}
                  />
                  {proxyParseError ? (
                    <p className="text-xs text-destructive">{proxyParseError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Paste your full proxy string (e.g., gate.example.com:1080:user:pass) to auto-fill fields below
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Proxy Server</label>
                    <Input
                      placeholder="e.g., gate.example.com:1080"
                      value={settings.proxy.server}
                      onChange={(e) => updateProxy({ server: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Protocol</label>
                    <Select
                      value={settings.proxy.protocol}
                      onValueChange={(value: "http" | "socks5") =>
                        updateProxy({ protocol: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http">HTTP</SelectItem>
                        <SelectItem value="socks5">SOCKS5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <Input
                      placeholder="Proxy username"
                      value={settings.proxy.username}
                      onChange={(e) => updateProxy({ username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      placeholder="Proxy password"
                      value={settings.proxy.password}
                      onChange={(e) => updateProxy({ password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <Button
                    variant="outline"
                    onClick={testProxyConnection}
                    disabled={testingProxy || !settings.proxy.server}
                  >
                    {testingProxy && <IconLoader2 className="h-4 w-4 animate-spin" />}
                    Test Connection
                  </Button>
                  {proxyStatus === "success" && (
                    <span className="flex items-center gap-2 text-sm text-positive">
                      <IconCheck className="h-4 w-4" />
                      Connected{proxyIp ? ` (IP: ${proxyIp})` : ""}
                    </span>
                  )}
                  {proxyStatus === "error" && (
                    <span className="flex items-center gap-2 text-sm text-destructive">
                      <IconAlertCircle className="h-4 w-4" />
                      {proxyError || "Connection failed"}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Settings */}
        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <IconAnalyze className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Analysis Settings</CardTitle>
                  <CardDescription>
                    Configure how brand analysis is performed
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Max Mentions per Brand
                  </label>
                  <Input
                    type="number"
                    min={10}
                    max={200}
                    value={settings.analysis.maxMentionsPerBrand}
                    onChange={(e) =>
                      updateAnalysis({ maxMentionsPerBrand: parseInt(e.target.value) || 50 })
                    }
                  />
                  {validationErrors["analysis.maxMentionsPerBrand"] ? (
                    <p className="text-xs text-destructive">{validationErrors["analysis.maxMentionsPerBrand"]}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Maximum Reddit mentions to collect per brand (10-200)</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Max Subreddits
                  </label>
                  <Input
                    type="number"
                    min={5}
                    max={50}
                    value={settings.analysis.maxSubreddits}
                    onChange={(e) =>
                      updateAnalysis({ maxSubreddits: parseInt(e.target.value) || 10 })
                    }
                  />
                  {validationErrors["analysis.maxSubreddits"] ? (
                    <p className="text-xs text-destructive">{validationErrors["analysis.maxSubreddits"]}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Maximum subreddits to search per brand (5-50)</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Sentiment Confidence Threshold
                  </label>
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    value={settings.analysis.sentimentConfidenceThreshold}
                    onChange={(e) =>
                      updateAnalysis({
                        sentimentConfidenceThreshold: parseInt(e.target.value) || 70,
                      })
                    }
                  />
                  {validationErrors["analysis.sentimentConfidenceThreshold"] ? (
                    <p className="text-xs text-destructive">{validationErrors["analysis.sentimentConfidenceThreshold"]}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Minimum confidence score to include sentiment results (50-100%)</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Job Settings */}
        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <IconSettings className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Job Settings</CardTitle>
                  <CardDescription>
                    Configure background job processing
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Max Concurrent Jobs
                  </label>
                  <Select
                    value={settings.jobs.maxConcurrent.toString()}
                    onValueChange={(value) =>
                      updateJobs({ maxConcurrent: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 job</SelectItem>
                      <SelectItem value="2">2 jobs</SelectItem>
                      <SelectItem value="3">3 jobs</SelectItem>
                      <SelectItem value="4">4 jobs</SelectItem>
                      <SelectItem value="5">5 jobs</SelectItem>
                    </SelectContent>
                  </Select>
                  {validationErrors["jobs.maxConcurrent"] ? (
                    <p className="text-xs text-destructive">{validationErrors["jobs.maxConcurrent"]}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Maximum number of analysis jobs running simultaneously</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Job Timeout (minutes)
                  </label>
                  <Input
                    type="number"
                    min={5}
                    max={30}
                    value={settings.jobs.timeoutMinutes}
                    onChange={(e) =>
                      updateJobs({ timeoutMinutes: parseInt(e.target.value) || 10 })
                    }
                  />
                  {validationErrors["jobs.timeoutMinutes"] ? (
                    <p className="text-xs text-destructive">{validationErrors["jobs.timeoutMinutes"]}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Maximum time for a single job before timeout (5-30 minutes)</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Danger Zone */}
        <TabsContent value="danger">
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <CardTitle className="text-destructive">Reset Application</CardTitle>
                  <CardDescription>
                    Permanently delete all application data. Your settings and API keys will be preserved.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will delete all brands, analyses, audiences, influencers, competitors,
                  jobs, and reports. This action is irreversible.
                </p>
                <Button
                  variant="destructive"
                  onClick={handleResetApplication}
                  disabled={isResetting}
                >
                  {isResetting && <IconLoader2 className="h-4 w-4 animate-spin" />}
                  <IconTrash className="h-4 w-4" />
                  Reset Application
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <ErrorBanner error={error} />

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <IconLoader2 className="h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </PageLayout>
  );
}
