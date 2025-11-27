import { PipelineColumn } from "./PipelineColumn";
import { SdrRanking } from "./SdrRanking";
import { SdrPerformanceTable } from "./SdrPerformanceTable";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TVContentProps {
  totalNovoLead: { valor: number; meta: number };
  funnelDataA: any[];
  funnelDataB: any[];
  topSdrs: any[];
  allSdrs: any[];
  isLoading?: boolean;
  lastUpdate?: Date | { dealsWithoutCloser?: number };
}

// Função para determinar cor baseada no percentual
const getPercentColor = (pct: number): string => {
  if (pct <= 35) return "text-red-500";
  if (pct <= 75) return "text-yellow-500";
  return "text-green-500";
};

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
      {/* Grid principal - mais espaço para tabela */}
      <div className="grid grid-cols-[130px_130px_140px_1fr] gap-3 flex-1 min-h-0">
        {/* Novo Lead Total - Compacto inline */}
        <div className="col-span-2 flex justify-center items-center">
          <div className="bg-card border border-primary/20 rounded px-3 py-0.5 flex items-center gap-2 text-sm">
            <span className="text-xs font-semibold">📥 Novo Lead</span>
            <span className="font-bold text-foreground">{totalNovoLead.valor}/{totalNovoLead.meta}</span>
            <span className={cn("font-bold", getPercentColor(percentual))}>{percentual}%</span>
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
        <div className="h-full flex flex-col min-h-0 overflow-hidden">
          <SdrPerformanceTable 
            sdrs={allSdrs} 
            dealsWithoutCloser={lastUpdate && typeof lastUpdate === 'object' && 'dealsWithoutCloser' in lastUpdate ? lastUpdate.dealsWithoutCloser : undefined} 
          />
        </div>
      </div>
    </div>
  );
}
