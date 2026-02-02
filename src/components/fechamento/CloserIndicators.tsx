import { Badge } from '@/components/ui/badge';
import { SdrIndicatorCard } from '@/components/sdr-fechamento/SdrIndicatorCard';
import { NoShowIndicator } from '@/components/sdr-fechamento/NoShowIndicator';
import { SdrMonthKpi, SdrCompPlan, SdrMonthPayout } from '@/types/sdr-fechamento';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, FileCheck, Percent, Calendar } from 'lucide-react';

interface CloserIndicatorsProps {
  kpi: SdrMonthKpi | null;
  payout: SdrMonthPayout;
  compPlan: SdrCompPlan | null;
  diasUteisMes: number;
  sdrMetaDiaria: number;
}

export const CloserIndicators = ({
  kpi,
  payout,
  compPlan,
  diasUteisMes,
  sdrMetaDiaria,
}: CloserIndicatorsProps) => {
  // Cálculos específicos para Closer
  const metaAlocadasCalculada = sdrMetaDiaria * diasUteisMes;
  const alocadasRealizado = kpi?.reunioes_agendadas || 0;
  
  // R1 Realizadas = reuniões com status completed ou contract_paid
  const r1Realizadas = kpi?.reunioes_realizadas || 0;
  
  // Meta de realizadas = 70% do que foi alocado
  const metaRealizadasCalculada = Math.round(alocadasRealizado * 0.7);
  
  // Contratos Pagos (obtido da contagem de intermediações ou campo específico)
  const contratosPagos = kpi?.intermediacoes_contrato || 0;
  
  // Taxa de Conversão = Contratos / Realizadas × 100
  const taxaConversao = r1Realizadas > 0 
    ? Math.round((contratosPagos / r1Realizadas) * 100) 
    : 0;
  
  // No-Shows
  const noShows = kpi?.no_shows || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* R1 Alocadas (equivalente a Agendadas para SDR) */}
      <SdrIndicatorCard
        title="Reuniões Alocadas"
        meta={sdrMetaDiaria}
        metaAjustada={payout.meta_agendadas_ajustada ?? metaAlocadasCalculada}
        realizado={alocadasRealizado}
        pct={payout.pct_reunioes_agendadas || 0}
        multiplicador={payout.mult_reunioes_agendadas || 0}
        valorBase={compPlan?.valor_meta_rpg || 0}
        valorFinal={payout.valor_reunioes_agendadas || 0}
        isManual={false}
      />

      {/* R1 Realizadas */}
      <SdrIndicatorCard
        title="R1 Realizadas"
        meta={alocadasRealizado}
        metaAjustada={metaRealizadasCalculada}
        realizado={r1Realizadas}
        pct={metaRealizadasCalculada > 0 ? Math.round((r1Realizadas / metaRealizadasCalculada) * 100) : 0}
        multiplicador={payout.mult_reunioes_realizadas || 0}
        valorBase={compPlan?.valor_docs_reuniao || 0}
        valorFinal={payout.valor_reunioes_realizadas || 0}
        isManual={false}
      />

      {/* No-Show Indicator */}
      <NoShowIndicator
        agendadas={alocadasRealizado}
        noShows={noShows}
      />

      {/* Contratos Pagos */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <FileCheck className="h-4 w-4 text-green-500" />
              Contratos Pagos
            </div>
            <Badge variant="outline" className="text-[10px] border-green-500 text-green-500">
              Hubla
            </Badge>
          </div>
          <div className="text-2xl font-bold text-green-500">
            {contratosPagos}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Intermediações contabilizadas no mês
          </div>
        </CardContent>
      </Card>

      {/* Taxa de Conversão */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Percent className="h-4 w-4 text-blue-500" />
              Taxa de Conversão
            </div>
            <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-500">
              Calculado
            </Badge>
          </div>
          <div className="text-2xl font-bold">
            {taxaConversao}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Contratos / Realizadas × 100
          </div>
        </CardContent>
      </Card>

      {/* R2 Agendadas (placeholder - precisa de campo específico) */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Calendar className="h-4 w-4 text-purple-500" />
              R2 Agendadas
            </div>
            <Badge variant="outline" className="text-[10px] border-purple-500 text-purple-500">
              Agenda
            </Badge>
          </div>
          <div className="text-2xl font-bold text-muted-foreground">
            -
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Reuniões de follow-up agendadas
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
