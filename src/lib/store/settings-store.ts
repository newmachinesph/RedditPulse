import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Settings, ProxySettings, AnalysisSettings, JobSettings } from "@/lib/types";

// Check if we're in a Tauri environment
const isTauri = () => {
  return typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined;
};

// Dynamic import with Tauri check
const getInvoke = async () => {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment. Please run via 'npm run tauri dev'");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke;
};

const defaultSettings: Settings = {
  serperApiKey: "",
  openaiApiKey: "",
  claudeApiKey: "",
  aiProvider: "openai",
  proxy: {
    enabled: false,
    server: "",
    username: "",
    password: "",
    protocol: "http",
  },
  analysis: {
    maxMentionsPerBrand: 50,
    maxSubreddits: 10,
    sentimentConfidenceThreshold: 70,
  },
  jobs: {
    maxConcurrent: 3,
    timeoutMinutes: 10,
  },
};

interface SettingsState {
  settings: Settings;
  isInitialized: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface SettingsActions {
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  updateSerperApiKey: (key: string) => void;
  updateOpenaiApiKey: (key: string) => void;
  updateClaudeApiKey: (key: string) => void;
  updateAiProvider: (provider: "openai" | "claude") => void;
  updateProxy: (proxy: Partial<ProxySettings>) => void;
  updateAnalysis: (analysis: Partial<AnalysisSettings>) => void;
  updateJobs: (jobs: Partial<JobSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  immer((set, get) => ({
    // State
    settings: defaultSettings,
    isInitialized: false,
    isLoading: false,
    isSaving: false,
    error: null,

    // Actions
    loadSettings: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const invoke = await getInvoke();
        const settings = await invoke<Settings>("get_settings");
        set((state) => {
          state.settings = { ...defaultSettings, ...settings };
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
        set((state) => {
          state.error = error instanceof Error ? error.message : String(error);
        });
      } finally {
        set((state) => {
          state.isLoading = false;
          state.isInitialized = true;
        });
      }
    },

    saveSettings: async () => {
      set((state) => {
        state.isSaving = true;
        state.error = null;
      });

      try {
        const invoke = await getInvoke();
        const currentSettings = get().settings;
        await invoke("update_settings", { settings: currentSettings });
      } catch (error) {
        console.error("Failed to save settings:", error);
        const errorMessage = typeof error === "string" ? error :
          error instanceof Error ? error.message :
          JSON.stringify(error);
        set((state) => {
          state.error = errorMessage;
        });
      } finally {
        set((state) => {
          state.isSaving = false;
        });
      }
    },

    updateSerperApiKey: (key) =>
      set((state) => {
        state.settings.serperApiKey = key;
      }),

    updateOpenaiApiKey: (key) =>
      set((state) => {
        state.settings.openaiApiKey = key;
      }),

    updateClaudeApiKey: (key) =>
      set((state) => {
        state.settings.claudeApiKey = key;
      }),

    updateAiProvider: (provider) =>
      set((state) => {
        state.settings.aiProvider = provider;
      }),

    updateProxy: (proxy) =>
      set((state) => {
        Object.assign(state.settings.proxy, proxy);
      }),

    updateAnalysis: (analysis) =>
      set((state) => {
        Object.assign(state.settings.analysis, analysis);
      }),

    updateJobs: (jobs) =>
      set((state) => {
        Object.assign(state.settings.jobs, jobs);
      }),

    resetSettings: () =>
      set((state) => {
        state.settings = defaultSettings;
      }),
  }))
);
