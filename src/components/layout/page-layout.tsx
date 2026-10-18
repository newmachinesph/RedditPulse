import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function PageLayout({ children, title, subtitle, action }: PageLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} action={action} />
        <main data-tour="main-content" className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
