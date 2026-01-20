import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RealTimeAlerts } from "@/components/dashboard/RealTimeAlerts";
import { TwilioSoftphone } from "@/components/crm/TwilioSoftphone";
import { ConversationsProvider } from "@/contexts/ConversationsContext";
import { ConversationsFloatingWidget } from "@/components/conversations/ConversationsFloatingWidget";
import { ConversationsDrawer } from "@/components/conversations/ConversationsDrawer";
import { QualificationAndScheduleModal } from "@/components/crm/QualificationAndScheduleModal";
import { useTwilio } from "@/contexts/TwilioContext";
import { Menu } from "lucide-react";

function GlobalQualificationModal() {
  const { 
    qualificationModalOpen, 
    qualificationDealId, 
    qualificationContactName,
    closeQualificationModal 
  } = useTwilio();
  
  if (!qualificationDealId) return null;
  
  return (
    <QualificationAndScheduleModal
      open={qualificationModalOpen}
      onOpenChange={(open) => !open && closeQualificationModal()}
      dealId={qualificationDealId}
      contactName={qualificationContactName || undefined}
      autoFocus="qualification"
    />
  );
}

// Feature flag - set to true when conversations feature is ready
const ENABLE_CONVERSATIONS_WIDGET = false;

export function MainLayout() {
  return (
    <ConversationsProvider>
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1 overflow-hidden">
            <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6">
              <SidebarTrigger className="md:hidden p-2 hover:bg-muted rounded-md">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <div className="flex-1" />
              <RealTimeAlerts />
            </header>
            <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-5">
              <Outlet />
            </div>
          </SidebarInset>
          <TwilioSoftphone />
          <GlobalQualificationModal />
          {ENABLE_CONVERSATIONS_WIDGET && <ConversationsFloatingWidget />}
          {ENABLE_CONVERSATIONS_WIDGET && <ConversationsDrawer />}
        </div>
      </SidebarProvider>
    </ConversationsProvider>
  );
}
