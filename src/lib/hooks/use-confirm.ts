import { useState, useCallback } from "react";

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "default" | "destructive";
}

export interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "default",
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? "Confirm",
        variant: options.variant ?? "default",
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  return { confirmState: state, confirm, handleConfirm, handleCancel };
}
