import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { RealTimeAlerts } from "@/components/dashboard/RealTimeAlerts";
import { TwilioSoftphone } from "@/components/crm/TwilioSoftphone";
import { ConversationsProvider } from "@/contexts/ConversationsContext";
import { ConversationsFloatingWidget } from "@/components/conversations/ConversationsFloatingWidget";
import { ConversationsDrawer } from "@/components/conversations/ConversationsDrawer";

export function MainLayout() {
  return (
    <ConversationsProvider>
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1 overflow-hidden">
            <header className="flex h-14 items-center justify-end gap-4 border-b border-border bg-background px-6">
              <RealTimeAlerts />
            </header>
            <div className="flex-1 overflow-hidden p-5">
              <Outlet />
            </div>
          </SidebarInset>
          <TwilioSoftphone />
          <ConversationsFloatingWidget />
          <ConversationsDrawer />
        </div>
      </SidebarProvider>
    </ConversationsProvider>
  );
}
