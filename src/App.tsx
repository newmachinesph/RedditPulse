import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui";
import {
  DashboardPage,
  BrandsListPage,
  BrandDetailPage,
  AudiencesPage,
  InfluencersPage,
  CompetitorsPage,
  JobsPage,
  SettingsPage,
} from "@/pages";
import { startTour, shouldAutoStartTour } from "@/lib/tour";
import "driver.js/dist/driver.css";
import "./index.css";

function TourAutoStart() {
  useEffect(() => {
    if (shouldAutoStartTour()) {
      // Delay to allow the UI to fully render
      const timer = setTimeout(() => startTour(), 800);
      return () => clearTimeout(timer);
    }
  }, []);
  return null;
}

function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <TourAutoStart />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/brands" element={<BrandsListPage />} />
          <Route path="/brands/:id" element={<BrandDetailPage />} />
          <Route path="/audiences" element={<AudiencesPage />} />
          <Route path="/influencers" element={<InfluencersPage />} />
          <Route path="/competitors" element={<CompetitorsPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" theme="dark" />
    </TooltipProvider>
  );
}

export default App;
