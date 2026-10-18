import type { ReactNode } from "react";
import { Card } from "./card";
import { Button } from "./button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  secondaryText?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  secondaryText,
  actionLabel,
  onAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
        {description}
      </p>
      {secondaryText && (
        <p className="mt-2 text-xs text-muted-foreground text-center max-w-sm">
          {secondaryText}
        </p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {secondaryAction && <div className="mt-2">{secondaryAction}</div>}
    </Card>
  );
}
