import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RealTimeAlerts } from "@/components/dashboard/RealTimeAlerts";
import { TwilioSoftphone } from "@/components/crm/TwilioSoftphone";

export function MainLayout() {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-6">
            <SidebarTrigger className="text-foreground" />
            <RealTimeAlerts />
          </header>
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        </SidebarInset>
        <TwilioSoftphone />
      </div>
    </SidebarProvider>
  );
}
