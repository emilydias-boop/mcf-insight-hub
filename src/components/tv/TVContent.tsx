import { PipelineColumn } from "./PipelineColumn";
import { SdrRanking } from "./SdrRanking";
import { SdrPerformanceTable } from "./SdrPerformanceTable";
import { RevenueProgressBar } from "./RevenueProgressBar";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTVRevenueData } from "@/hooks/useTVRevenueData";

interface TVContentProps {
  totalNovoLead: { valor: number; meta: number };
  funnelDataA: any[];
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
  topSdrs,
  allSdrs,
  isLoading,
  lastUpdate,
}: TVContentProps) {
  const isMobile = useIsMobile();
  const { semanal, mensal, isLoading: revenueLoading } = useTVRevenueData();

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

  // Layout Mobile
  if (isMobile) {
    return (
      <div className="flex flex-col h-full gap-3 overflow-y-auto">
        {/* Header Compacto */}
        <div className="flex justify-center shrink-0">
          <div className="bg-card border border-primary/20 rounded px-3 py-1.5 flex items-center gap-2 text-sm">
            <span className="text-xs font-semibold">📥 Novo Lead</span>
            <span className="font-bold text-foreground">{totalNovoLead.valor}/{totalNovoLead.meta}</span>
            <span className={cn("font-bold", getPercentColor(percentual))}>{percentual}%</span>
          </div>
        </div>

        {/* Barras de Progresso de Faturamento */}
        <div className="grid grid-cols-1 gap-2 shrink-0">
          <RevenueProgressBar
            title="Meta do Mês"
            atual={mensal.atual}
            meta={mensal.meta}
            percentual={mensal.percentual}
          />
          <RevenueProgressBar
            title="Meta da Semana"
            atual={semanal.atual}
            meta={semanal.meta}
            percentual={semanal.percentual}
          />
        </div>

        {/* Pipeline Lead A */}
        <div className="shrink-0">
          <h3 className="font-bold text-center text-xs mb-1">Lead A</h3>
          <PipelineColumn funnelData={funnelDataA} leadType="A" />
        </div>

        {/* Ranking TOP 4 - SEGUNDO */}
        <div className="shrink-0">
          <h3 className="font-bold text-center text-sm mb-2">🏆 Top 4</h3>
          <div className="grid grid-cols-2 gap-2">
            {topSdrs.slice(0, 4).map((sdr, index) => {
              const medals = ["🥇", "🥈", "🥉", "🏅"];
              return (
                <div key={sdr.email} className="bg-card border border-primary/20 rounded p-2 flex items-center gap-2">
                  <span className="text-lg">{medals[index]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs truncate">{sdr.nome}</div>
                    <div className="text-xs font-bold text-primary">{sdr.score}pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabela de SDRs - TERCEIRO */}
        <div className="shrink-0">
          <SdrPerformanceTable 
            sdrs={allSdrs} 
            dealsWithoutCloser={lastUpdate && typeof lastUpdate === 'object' && 'dealsWithoutCloser' in lastUpdate ? lastUpdate.dealsWithoutCloser : undefined} 
          />
        </div>
      </div>
    );
  }

  // Layout Desktop/TV
  return (
    <div className="flex flex-col h-full gap-3">
      {/* Barras de Progresso de Faturamento - Topo */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <RevenueProgressBar
          title="Meta do Mês"
          atual={mensal.atual}
          meta={mensal.meta}
          percentual={mensal.percentual}
        />
        <RevenueProgressBar
          title="Meta da Semana"
          atual={semanal.atual}
          meta={semanal.meta}
          percentual={semanal.percentual}
        />
      </div>

      {/* Grid principal - mais espaço para tabela */}
      <div className="grid grid-cols-[170px_160px_1fr] gap-4 flex-1 min-h-0">
        {/* Novo Lead Total - Compacto inline */}
        <div className="flex justify-center items-center">
          <div className="bg-card border border-primary/20 rounded px-4 py-1.5 flex items-center gap-3 text-base">
            <span className="text-sm font-semibold">📥 Novo Lead</span>
            <span className="font-bold text-foreground text-lg">{totalNovoLead.valor}/{totalNovoLead.meta}</span>
            <span className={cn("font-bold text-lg", getPercentColor(percentual))}>{percentual}%</span>
          </div>
        </div>
        <div className="col-span-2"></div>

        {/* Coluna 1: Lead A */}
        <div className="flex flex-col gap-2 h-full">
          <h3 className="font-bold text-center text-base">Lead A</h3>
          <PipelineColumn funnelData={funnelDataA} leadType="A" />
        </div>

        {/* Coluna 2: Ranking */}
        <div className="flex flex-col gap-2 h-full">
          <h3 className="font-bold text-center text-base">🏆 Top 4</h3>
          <SdrRanking topSdrs={topSdrs} />
        </div>

        {/* Coluna 3: Tabela */}
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
