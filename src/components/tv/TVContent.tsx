import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineGauges } from "./PipelineGauges";
import { SdrRanking } from "./SdrRanking";
import { SdrPerformanceTable } from "./SdrPerformanceTable";
import { RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/formatters";

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
  lastUpdate,
}: TVContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-muted-foreground">Carregando dados da TV SDR...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">📊 TV SDR Performance</h1>
          <p className="text-muted-foreground mt-1">Acompanhamento em tempo real do pipeline</p>
        </div>
        {lastUpdate && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizado: {formatDateTime(lastUpdate)}
          </div>
        )}
      </div>

      {/* Pipeline Gauges */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Pipeline Inside Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineGauges funnelDataA={funnelDataA} funnelDataB={funnelDataB} />
        </CardContent>
      </Card>

      {/* Top 4 Ranking */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl">🏆 Top 4 SDRs da Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <SdrRanking topSdrs={topSdrs} />
        </CardContent>
      </Card>

      {/* Performance Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Performance Individual</CardTitle>
        </CardHeader>
        <CardContent>
          <SdrPerformanceTable sdrs={allSdrs} />
        </CardContent>
      </Card>
    </div>
  );
}
