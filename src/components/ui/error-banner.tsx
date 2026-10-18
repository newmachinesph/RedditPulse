interface ErrorBannerProps {
  error: string | null;
  onDismiss?: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-center justify-between">
      <p className="text-sm text-destructive">{error}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-destructive/70 hover:text-destructive text-sm ml-2"
          aria-label="Dismiss error"
        >
          &times;
        </button>
      )}
    </div>
  );
}
