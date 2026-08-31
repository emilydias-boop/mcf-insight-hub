import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { RealTimeAlerts } from "@/components/dashboard/RealTimeAlerts";
import { TwilioSoftphone } from "@/components/crm/TwilioSoftphone";
import { QuickDialerLauncher } from "@/components/crm/QuickDialerLauncher";
import { SonaxWebphoneWidget } from "@/components/crm/SonaxWebphoneWidget";
import { QualificationAndScheduleModal } from "@/components/crm/QualificationAndScheduleModal";
import { OverdueAlertOverlay } from "@/components/sdr/OverdueAlertOverlay";
import { CloserPendingDocsAlert } from "@/components/closer/CloserPendingDocsAlert";
import { useTwilio } from "@/contexts/TwilioContext";
import { AutoDialerProvider } from "@/contexts/AutoDialerContext";
import { DialerLauncherProvider } from "@/contexts/DialerLauncherContext";
import { AutoDialerInCallBanner } from "@/components/sdr/AutoDialerInCallBanner";
import { AutoDialerOutcomeBanner } from "@/components/sdr/AutoDialerOutcomeBanner";
import { AutoDialerDealDrawer } from "@/components/sdr/AutoDialerDealDrawer";
import { Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import { usePageAccessLog } from "@/hooks/usePageAccessLog";

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

export function MainLayout() {
  const { allRoles } = useAuth();
  usePageAccessLog();
  // Quem tem papel operacional de telefone (SDR, closer, closer sombra e cobrança do consórcio) recebe softphone e discador. Admin e manager não ligam pelo sistema.
  const roles = (allRoles as string[] | undefined) ?? [];
  const podeDiscar =
    roles.includes("sdr") ||
    roles.includes("closer") ||
    roles.includes("closer_sombra") ||
    roles.includes("cobranca_consorcio");
  return (
      <SidebarProvider defaultOpen={false}>
        <AutoDialerProvider>
        <DialerLauncherProvider>
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
          {isSDR && (
            <>
              <TwilioSoftphone />
              <QuickDialerLauncher />
              <AutoDialerDealDrawer />
              <AutoDialerInCallBanner />
              <AutoDialerOutcomeBanner />
            </>
          )}
          <SonaxWebphoneWidget />
          <OverdueAlertOverlay />
          <CloserPendingDocsAlert />
          <GlobalQualificationModal />
        </div>
        </DialerLauncherProvider>
        </AutoDialerProvider>
      </SidebarProvider>
  );
}
