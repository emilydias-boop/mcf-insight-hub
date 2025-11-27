import { PipelineColumn } from "./PipelineColumn";
import { SdrRanking } from "./SdrRanking";
import { SdrPerformanceTable } from "./SdrPerformanceTable";
import { RefreshCw } from "lucide-react";

interface TVContentProps {
  funnelDataA: any[];
  funnelDataB: any[];
  topSdrs: any[];
  allSdrs: any[];
  isLoading?: boolean;
  lastUpdate?: Date;
}

export function TVContent({
  funnelDataA,
  funnelDataB,
  topSdrs,
  allSdrs,
  isLoading,
}: TVContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[180px_180px_240px_1fr] gap-3 h-screen p-3">
      {/* Coluna 1: Lead A */}
      <div className="space-y-2">
        <h3 className="font-bold text-center text-sm">Lead A</h3>
        <PipelineColumn funnelData={funnelDataA} leadType="A" />
      </div>

      {/* Coluna 2: Lead B */}
      <div className="space-y-2">
        <h3 className="font-bold text-center text-sm">Lead B</h3>
        <PipelineColumn funnelData={funnelDataB} leadType="B" />
      </div>

      {/* Coluna 3: Ranking */}
      <div className="space-y-2">
        <h3 className="font-bold text-center text-sm">🏆 Top 4</h3>
        <SdrRanking topSdrs={topSdrs} />
      </div>

      {/* Coluna 4: Tabela */}
      <div className="overflow-auto">
        <SdrPerformanceTable sdrs={allSdrs} />
      </div>
    </div>
  );
}
