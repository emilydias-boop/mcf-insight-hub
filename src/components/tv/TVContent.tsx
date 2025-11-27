import { PipelineColumn } from "./PipelineColumn";
import { SdrRanking } from "./SdrRanking";
import { SdrPerformanceTable } from "./SdrPerformanceTable";
import { RefreshCw } from "lucide-react";

interface TVContentProps {
  totalNovoLead: { valor: number; meta: number };
  funnelDataA: any[];
  funnelDataB: any[];
  topSdrs: any[];
  allSdrs: any[];
  isLoading?: boolean;
  lastUpdate?: Date | { dealsWithoutCloser?: number };
}

export function TVContent({
  totalNovoLead,
  funnelDataA,
  funnelDataB,
  topSdrs,
  allSdrs,
  isLoading,
  lastUpdate,
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

  const percentual = totalNovoLead.meta > 0 
    ? Math.round((totalNovoLead.valor / totalNovoLead.meta) * 100) 
    : 0;

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Grid principal com Novo Lead no topo */}
      <div className="grid grid-cols-[180px_180px_220px_minmax(500px,1fr)] gap-3 flex-1 min-h-0">
        {/* Novo Lead Total - Compacto no topo */}
        <div className="col-span-2 flex justify-center items-center">
          <div className="bg-card border border-primary/20 rounded-lg px-4 py-1.5 flex items-center gap-3">
            <span className="text-sm font-semibold">📥 Novo Lead</span>
            <span className="text-lg font-bold text-foreground">{totalNovoLead.valor}/{totalNovoLead.meta}</span>
            <span className="text-primary font-bold">{percentual}%</span>
          </div>
        </div>
        <div className="col-span-2"></div>
        {/* Coluna 1: Lead A */}
        <div className="flex flex-col gap-1.5 h-full">
          <h3 className="font-bold text-center text-sm">Lead A</h3>
          <PipelineColumn funnelData={funnelDataA} leadType="A" />
        </div>

      {/* Coluna 2: Lead B */}
      <div className="flex flex-col gap-1.5 h-full">
        <h3 className="font-bold text-center text-sm">Lead B</h3>
        <PipelineColumn funnelData={funnelDataB} leadType="B" />
      </div>

      {/* Coluna 3: Ranking */}
      <div className="flex flex-col gap-1.5 h-full">
        <h3 className="font-bold text-center text-sm">🏆 Top 4</h3>
        <SdrRanking topSdrs={topSdrs} />
      </div>

        {/* Coluna 4: Tabela */}
        <div className="h-full flex flex-col min-h-0">
          <SdrPerformanceTable 
            sdrs={allSdrs} 
            dealsWithoutCloser={lastUpdate && typeof lastUpdate === 'object' && 'dealsWithoutCloser' in lastUpdate ? lastUpdate.dealsWithoutCloser : undefined} 
          />
        </div>
      </div>
    </div>
  );
}
