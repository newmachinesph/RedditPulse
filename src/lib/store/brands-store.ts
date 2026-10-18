import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Brand } from "@/lib/types";

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

interface CreateBrandInput {
  name: string;
  industry: string;
  description?: string;
  website?: string;
}

interface UpdateBrandInput {
  name?: string;
  industry?: string;
  description?: string;
  website?: string;
}

interface BrandsState {
  brands: Brand[];
  selectedBrandId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface BrandsActions {
  loadBrands: () => Promise<void>;
  createBrand: (input: CreateBrandInput) => Promise<Brand | null>;
  updateBrand: (id: string, input: UpdateBrandInput) => Promise<Brand | null>;
  deleteBrandById: (id: string) => Promise<boolean>;
  selectBrand: (id: string | null) => void;
}

export const useBrandsStore = create<BrandsState & BrandsActions>()(
  immer((set) => ({
    // State
    brands: [],
    selectedBrandId: null,
    isLoading: false,
    error: null,

    // Actions
    loadBrands: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const invoke = await getInvoke();
        const brands = await invoke<Brand[]>("get_all_brands");
        set((state) => {
          state.brands = brands;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to load brands";
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    createBrand: async (input) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const invoke = await getInvoke();
        const brand = await invoke<Brand>("create_brand", { input });
        set((state) => {
          state.brands.unshift(brand);
        });
        return brand;
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to create brand";
        });
        return null;
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    updateBrand: async (id, input) => {
      try {
        const invoke = await getInvoke();
        const updated = await invoke<Brand | null>("update_brand", { id, input });
        if (updated) {
          set((state) => {
            const index = state.brands.findIndex((b) => b.id === id);
            if (index !== -1) {
              state.brands[index] = updated;
            }
          });
        }
        return updated;
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to update brand";
        });
        return null;
      }
    },

    deleteBrandById: async (id) => {
      try {
        const invoke = await getInvoke();
        const deleted = await invoke<boolean>("delete_brand", { id });
        if (deleted) {
          set((state) => {
            state.brands = state.brands.filter((b) => b.id !== id);
            if (state.selectedBrandId === id) {
              state.selectedBrandId = null;
            }
          });
        }
        return deleted;
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : "Failed to delete brand";
        });
        return false;
      }
    },

    selectBrand: (id) =>
      set((state) => {
        state.selectedBrandId = id;
      }),
  }))
);
