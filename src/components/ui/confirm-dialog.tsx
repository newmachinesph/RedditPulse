import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { Button } from "./button";
import type { ConfirmState } from "@/lib/hooks";

interface ConfirmDialogProps {
  state: ConfirmState;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ state, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={state.variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {state.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
