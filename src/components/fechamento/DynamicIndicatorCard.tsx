import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SdrIndicatorCard } from '@/components/sdr-fechamento/SdrIndicatorCard';
import { NoShowIndicator } from '@/components/sdr-fechamento/NoShowIndicator';
import { ActiveMetric, METRIC_CONFIG } from '@/hooks/useActiveMetricsForSdr';
import { SdrMonthKpi, SdrMonthPayout, getMultiplier } from '@/types/sdr-fechamento';
import { 
  Calendar, 
  Users, 
  Phone, 
  ClipboardCheck, 
  FileCheck, 
  CalendarPlus, 
  AlertTriangle, 
  Sparkles,
  Percent,
} from 'lucide-react';

interface DynamicIndicatorCardProps {
  metrica: ActiveMetric;
  kpi: SdrMonthKpi | null;
  payout: SdrMonthPayout;
  diasUteisMes: number;
  sdrMetaDiaria: number;
  variavelTotal?: number;
}

const iconMap: Record<string, React.ElementType> = {
  Calendar, Users, Phone, ClipboardCheck, FileCheck, CalendarPlus, AlertTriangle, Sparkles, Percent,
};

const colorMap: Record<string, string> = {
  green: 'text-green-500 border-green-500',
  blue: 'text-blue-500 border-blue-500',
  purple: 'text-purple-500 border-purple-500',
  yellow: 'text-yellow-500 border-yellow-500',
  red: 'text-red-500 border-red-500',
  primary: 'text-primary border-primary',
};

export const DynamicIndicatorCard = ({
  metrica,
  kpi,
  payout,
  diasUteisMes,
  sdrMetaDiaria,
  variavelTotal = 0,
}: DynamicIndicatorCardProps) => {
  const config = METRIC_CONFIG[metrica.nome_metrica];
  
  if (!config) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="text-sm font-medium">{metrica.label_exibicao}</div>
          <div className="text-muted-foreground text-xs">Métrica não configurada</div>
        </CardContent>
      </Card>
    );
  }

  // Special handling for no_show indicator
  if (metrica.nome_metrica === 'no_show') {
    return (
      <NoShowIndicator
        agendadas={kpi?.reunioes_agendadas || 0}
        noShows={kpi?.no_shows || 0}
      />
    );
  }

  const kpiValue = kpi ? (kpi as any)[config.kpiField] || 0 : 0;
  const baseVariavel = variavelTotal || 400;
  const pesoPercent = metrica.peso_percentual || 25;
  const valorBase = baseVariavel * (pesoPercent / 100);

  // Calculate meta based on metric type
  let metaAjustada: number;
  let metaDiaria: number;
  let metaSubtitle: string | undefined;

  const nome = metrica.nome_metrica;

  if (nome === 'agendamentos') {
    metaDiaria = sdrMetaDiaria;
    metaAjustada = (payout as any)?.meta_agendadas_ajustada || (sdrMetaDiaria * diasUteisMes);
  } else if (nome === 'realizadas') {
    const agendadasReais = kpi?.reunioes_agendadas || 0;
    metaDiaria = agendadasReais;
    metaAjustada = Math.round(agendadasReais * 0.7);
    metaSubtitle = `70% de ${agendadasReais} agend. = ${metaAjustada}`;
  } else if (nome === 'tentativas') {
    metaDiaria = 84;
    metaAjustada = (payout as any)?.meta_tentativas_ajustada ?? (84 * diasUteisMes);
  } else if (nome === 'organizacao') {
    metaDiaria = 100;
    metaAjustada = 100;
  } else if (nome === 'r2_agendadas') {
    const contratosPagos = kpi?.intermediacoes_contrato || 0;
    const pctContratos = metrica.meta_percentual && metrica.meta_percentual > 0 ? metrica.meta_percentual : 100;
    metaAjustada = Math.round((contratosPagos * pctContratos) / 100);
    metaDiaria = pctContratos;
    metaSubtitle = `${pctContratos}% de ${contratosPagos} contratos = ${metaAjustada}`;
  } else if (metrica.meta_percentual && metrica.meta_percentual > 0) {
    const realizadas = kpi?.reunioes_realizadas || 0;
    metaAjustada = Math.round((realizadas * metrica.meta_percentual) / 100);
    metaDiaria = metrica.meta_percentual;
    metaSubtitle = `${metrica.meta_percentual}% de ${realizadas} realiz. = ${metaAjustada}`;
  } else if (nome === 'contratos') {
    const realizadas = kpi?.reunioes_realizadas || 0;
    const pctContratos = metrica.meta_percentual && metrica.meta_percentual > 0 ? metrica.meta_percentual : 30;
    metaAjustada = Math.round((realizadas * pctContratos) / 100);
    metaDiaria = pctContratos;
    metaSubtitle = `${pctContratos}% de ${realizadas} realiz. = ${metaAjustada}`;
  } else {
    metaDiaria = metrica.meta_valor || 1;
    metaAjustada = metaDiaria * diasUteisMes;
  }

  const pct = metaAjustada > 0 ? (kpiValue / metaAjustada) * 100 : 0;
  const mult = getMultiplier(pct);
  const valorFinal = valorBase * mult;

  return (
    <SdrIndicatorCard
      title={metrica.label_exibicao}
      meta={metaDiaria}
      metaAjustada={metaAjustada}
      realizado={kpiValue}
      pct={pct}
      multiplicador={mult}
      valorBase={valorBase}
      valorFinal={valorFinal}
      isPercentage={config.isPercentage}
      isManual={!config.isAuto}
      metaSubtitle={metaSubtitle}
    />
  );
};

// Component to render a grid of dynamic indicators
interface DynamicIndicatorsGridProps {
  metricas: ActiveMetric[];
  kpi: SdrMonthKpi | null;
  payout: SdrMonthPayout;
  diasUteisMes: number;
  sdrMetaDiaria: number;
  variavelTotal?: number;
}

export const DynamicIndicatorsGrid = ({
  metricas,
  kpi,
  payout,
  diasUteisMes,
  sdrMetaDiaria,
  variavelTotal,
}: DynamicIndicatorsGridProps) => {
  if (!metricas || metricas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma métrica configurada para este cargo/período.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {metricas.map((metrica) => (
        <DynamicIndicatorCard
          key={metrica.nome_metrica}
          metrica={metrica}
          kpi={kpi}
          payout={payout}
          diasUteisMes={diasUteisMes}
          sdrMetaDiaria={sdrMetaDiaria}
          variavelTotal={variavelTotal}
        />
      ))}
    </div>
  );
};
