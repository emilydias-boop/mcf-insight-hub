import { useState } from "react";
import { TVContent } from "@/components/tv/TVContent";
import { SaleCelebration } from "@/components/tv/SaleCelebration";
import { useTVSdrData } from "@/hooks/useTVSdrData";
import { useSalesCelebration } from "@/hooks/useSalesCelebration";
import { Button } from "@/components/ui/button";
import { PartyPopper, PartyPopperIcon } from "lucide-react";

export default function TVSdrPerformance() {
  const { data, isLoading } = useTVSdrData();
  const { currentCelebration, handleCelebrationComplete } = useSalesCelebration();
  const [celebrationsPaused, setCelebrationsPaused] = useState(false);

  return (
    <div className="h-screen overflow-hidden p-4">
      <TVContent
        totalNovoLead={data?.totalNovoLead || { valor: 0, meta: 560 }}
        funnelData={data?.funnelData || []}
        topSdrs={data?.topSdrs || []}
        allSdrs={data?.allSdrs || []}
        isLoading={isLoading}
        lastUpdate={{ dealsWithoutCloser: data?.dealsWithoutCloser }}
      />

      {currentCelebration && !celebrationsPaused && (
        <SaleCelebration
          leadName={currentCelebration.leadName}
          leadType={currentCelebration.leadType}
          sdrName={currentCelebration.sdrName}
          closerName={currentCelebration.closerName}
          productName={currentCelebration.productName}
          onComplete={handleCelebrationComplete}
          onDismiss={handleCelebrationComplete}
        />
      )}

      {/* Botão de pausar celebrações */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant={celebrationsPaused ? "outline" : "default"}
          size="sm"
          onClick={() => setCelebrationsPaused(!celebrationsPaused)}
          className="gap-2"
        >
          <PartyPopper className="h-4 w-4" />
          {celebrationsPaused ? "Ativar Celebrações" : "Pausar Celebrações"}
        </Button>
      </div>
    </div>
  );
}
