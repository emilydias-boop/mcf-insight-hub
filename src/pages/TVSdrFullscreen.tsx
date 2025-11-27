import { TVContent } from "@/components/tv/TVContent";
import { SaleCelebration } from "@/components/tv/SaleCelebration";
import { useTVSdrData } from "@/hooks/useTVSdrData";
import { useSalesCelebration } from "@/hooks/useSalesCelebration";

export default function TVSdrFullscreen() {
  const { data, isLoading } = useTVSdrData();
  const { currentCelebration, handleCelebrationComplete } = useSalesCelebration();

  return (
    <div className="min-h-screen bg-background p-6">
      <TVContent
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
    </div>
  );
}
