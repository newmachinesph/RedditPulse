import { useEffect } from "react";
import { IconPlus, IconShield, IconShieldOff } from "@tabler/icons-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useSettingsStore } from "@/lib/store";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const { settings, isInitialized, loadSettings } = useSettingsStore();

  useEffect(() => {
    if (!isInitialized) {
      loadSettings();
    }
  }, [isInitialized, loadSettings]);

  const proxyEnabled = settings.proxy.enabled && settings.proxy.server;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Proxy Status Indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
              proxyEnabled
                ? "bg-positive/10 text-positive"
                : "bg-muted text-muted-foreground"
            }`}>
              {proxyEnabled ? (
                <IconShield className="h-4 w-4" />
              ) : (
                <IconShieldOff className="h-4 w-4" />
              )}
              <span>{proxyEnabled ? "Proxy On" : "Proxy Off"}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {proxyEnabled ? (
              <p>Proxy: {settings.proxy.server} ({settings.proxy.protocol.toUpperCase()})</p>
            ) : (
              <p>No proxy configured. Requests use direct connection.</p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Action Button */}
        {action && (
          <Button data-tour="header-action" onClick={action.onClick}>
            <IconPlus className="h-4 w-4" />
            {action.label}
          </Button>
        )}
      </div>
    </header>
  );
}
