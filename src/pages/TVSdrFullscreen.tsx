import { TVContent } from "@/components/tv/TVContent";
import { SaleCelebration } from "@/components/tv/SaleCelebration";
import { useTVSdrData } from "@/hooks/useTVSdrData";
import { useSalesCelebration } from "@/hooks/useSalesCelebration";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function TVSdrFullscreen() {
  const { data, isLoading } = useTVSdrData();
  const { currentCelebration, handleCelebrationComplete } = useSalesCelebration();

  const handleResetCelebrations = () => {
    localStorage.removeItem('celebrated_sales');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background p-6 relative">
      <TVContent
        totalNovoLead={data?.totalNovoLead || { valor: 0, meta: 560 }}
        funnelDataA={data?.funnelDataA || []}
        funnelDataB={data?.funnelDataB || []}
        topSdrs={data?.topSdrs || []}
        allSdrs={data?.allSdrs || []}
        isLoading={isLoading}
        lastUpdate={new Date()}
      />

      {currentCelebration && (
        <SaleCelebration
          leadName={currentCelebration.leadName}
          leadType={currentCelebration.leadType}
          sdrName={currentCelebration.sdrName}
          closerName={currentCelebration.closerName}
          productName={currentCelebration.productName}
          onComplete={handleCelebrationComplete}
        />
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed bottom-4 right-4 opacity-30 hover:opacity-100 transition-opacity h-8 w-8"
              onClick={handleResetCelebrations}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Resetar celebrações e reexibir vendas de hoje</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
