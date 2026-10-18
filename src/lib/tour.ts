import { driver, type DriveStep } from "driver.js";

const TOUR_COMPLETED_KEY = "redditpulse-tour-completed";

const steps: DriveStep[] = [
  {
    element: "[data-tour='sidebar']",
    popover: {
      title: "Navigation",
      description:
        "Use the sidebar to navigate between different sections of RedditPulse.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-dashboard']",
    popover: {
      title: "Dashboard",
      description:
        "Your home base. See an overview of all brands, sentiment stats, and recent jobs.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-brands']",
    popover: {
      title: "Brands",
      description:
        "Add and manage the brands you want to track on Reddit. Start here by adding your first brand.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-audiences']",
    popover: {
      title: "Audiences",
      description:
        "Create audience panels to segment Reddit users based on karma, activity, and engagement.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-influencers']",
    popover: {
      title: "Influencers",
      description:
        "Discover and track influential Reddit users who discuss your brands.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-competitors']",
    popover: {
      title: "Competitors",
      description:
        "Map competitor relationships and compare brand sentiment side by side.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-jobs']",
    popover: {
      title: "Jobs",
      description:
        "Monitor background analysis jobs, see progress, and review completed tasks.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='nav-settings']",
    popover: {
      title: "Settings",
      description:
        "Configure API keys, proxy settings, analysis parameters, and more.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='header-action']",
    popover: {
      title: "Quick Actions",
      description:
        "Use action buttons in the header for quick access to common tasks like adding brands.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: "[data-tour='main-content']",
    popover: {
      title: "Main Content",
      description:
        "This is where all your data, charts, and analysis results appear. Start by adding a brand to see it in action!",
      side: "left",
      align: "start",
    },
  },
];

export function startTour() {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: "black",
    stagePadding: 4,
    stageRadius: 8,
    popoverClass: "redditpulse-tour-popover",
    steps,
    onDestroyed: () => {
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    },
  });

  driverObj.drive();
}

export function shouldAutoStartTour(): boolean {
  return !localStorage.getItem(TOUR_COMPLETED_KEY);
}

export function resetTourStatus() {
  localStorage.removeItem(TOUR_COMPLETED_KEY);
}
