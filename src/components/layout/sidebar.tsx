import { NavLink } from "react-router-dom";
import {
  IconLayoutDashboard,
  IconBuildingStore,
  IconUsers,
  IconSpy,
  IconChartBar,
  IconSettings,
  IconActivity,
  IconClock,
  IconRoute,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { startTour } from "@/lib/tour";

const navigation = [
  { name: "Dashboard", href: "/", icon: IconLayoutDashboard, tourId: "nav-dashboard" },
  { name: "Brands", href: "/brands", icon: IconBuildingStore, tourId: "nav-brands" },
  { name: "Audiences", href: "/audiences", icon: IconUsers, tourId: "nav-audiences" },
  { name: "Influencers", href: "/influencers", icon: IconSpy, tourId: "nav-influencers" },
  { name: "Competitors", href: "/competitors", icon: IconChartBar, tourId: "nav-competitors" },
  { name: "Jobs", href: "/jobs", icon: IconClock, tourId: "nav-jobs" },
];

export function Sidebar() {
  return (
    <div data-tour="sidebar" className="flex h-full w-56 flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
        <IconActivity className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">RedditPulse</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            data-tour={item.tourId}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Tour & Settings */}
      <div className="border-t border-border p-2 space-y-1">
        <button
          onClick={() => startTour()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <IconRoute className="h-5 w-5" />
          Start Tour
        </button>
        <NavLink
          to="/settings"
          data-tour="nav-settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )
          }
        >
          <IconSettings className="h-5 w-5" />
          Settings
        </NavLink>
      </div>
    </div>
  );
}
