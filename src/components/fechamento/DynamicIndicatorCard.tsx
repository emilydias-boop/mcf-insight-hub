import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SdrIndicatorCard } from '@/components/sdr-fechamento/SdrIndicatorCard';
import { NoShowIndicator } from '@/components/sdr-fechamento/NoShowIndicator';
import { ActiveMetric, METRIC_CONFIG } from '@/hooks/useActiveMetricsForSdr';
import { SdrMonthKpi, SdrCompPlan, SdrMonthPayout, getMultiplier } from '@/types/sdr-fechamento';
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
  compPlan: SdrCompPlan | null;
  diasUteisMes: number;
  sdrMetaDiaria: number;
  variavelTotal?: number; // Total variável do cargo (fallback do cargo_catalogo)
}

const iconMap: Record<string, React.ElementType> = {
  Calendar,
  Users,
  Phone,
  ClipboardCheck,
  FileCheck,
  CalendarPlus,
  AlertTriangle,
  Sparkles,
  Percent,
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
  compPlan,
  diasUteisMes,
  sdrMetaDiaria,
  variavelTotal = 0,
}: DynamicIndicatorCardProps) => {
  const config = METRIC_CONFIG[metrica.nome_metrica];
  
  if (!config) {
    // Fallback for unknown metrics
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="text-sm font-medium">{metrica.label_exibicao}</div>
          <div className="text-muted-foreground text-xs">Métrica não configurada</div>
        </CardContent>
      </Card>
    );
  }

  const Icon = iconMap[config.icon] || Calendar;
  const colorClasses = colorMap[config.color] || colorMap.green;

  // Special handling for no_show indicator
  if (metrica.nome_metrica === 'no_show') {
    return (
      <NoShowIndicator
        agendadas={kpi?.reunioes_agendadas || 0}
        noShows={kpi?.no_shows || 0}
      />
    );
  }

  // Get values from KPI
  const kpiValue = kpi ? (kpi as any)[config.kpiField] || 0 : 0;

  // For metrics with isDynamicCalc (contratos, vendas_parceria), calculate values dynamically
  if (config.isDynamicCalc) {
    // Use variável total do cargo_catalogo ou compPlan
    const baseVariavel = variavelTotal || compPlan?.variavel_total || 1200;
    const pesoPercent = metrica.peso_percentual || 25;
    const valorBase = baseVariavel * (pesoPercent / 100);
    
    // NOVA LÓGICA: Se meta_percentual está definida, usar % das Realizadas
    let metaAjustada: number;
    let metaDiaria: number;
    
    if (metrica.meta_percentual && metrica.meta_percentual > 0) {
      // Meta dinâmica: X% das Realizadas
      const realizadas = kpi?.reunioes_realizadas || 0;
      metaAjustada = Math.round((realizadas * metrica.meta_percentual) / 100);
      metaDiaria = metrica.meta_percentual; // Exibir como %
    } else {
      // Meta fixa: valor diário × dias úteis (comportamento anterior)
      metaDiaria = metrica.meta_valor || 1;
      metaAjustada = metaDiaria * diasUteisMes;
    }
    
    // Calcular percentual e multiplicador
    const pct = metaAjustada > 0 ? (kpiValue / metaAjustada) * 100 : 0;
    const mult = getMultiplier(pct);
    const valorFinal = valorBase * mult;

    // Custom subtitle based on meta type
    const isPercentualMeta = metrica.meta_percentual && metrica.meta_percentual > 0;
    const metaSubtitle = isPercentualMeta 
      ? `${metrica.meta_percentual}% de ${kpi?.reunioes_realizadas || 0} realiz. = ${metaAjustada}`
      : undefined;

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
        isPercentage={false}
        isManual={false}
        metaSubtitle={metaSubtitle}
      />
    );
  }
  
  // For metrics that use SdrIndicatorCard (have payout percentage fields)
  if (config.payoutPctField && config.payoutMultField && config.payoutValueField) {
    const pct = (payout as any)[config.payoutPctField] || 0;
    const mult = (payout as any)[config.payoutMultField] || 0;
    const valorFinal = (payout as any)[config.payoutValueField] || 0;
    const valorBase = compPlan ? (compPlan as any)[config.compPlanValueField] || 0 : 0;

    // Calculate meta based on metric type
    let meta = 0;
    let metaAjustada = 0;
    
    if (metrica.nome_metrica === 'agendamentos') {
      meta = sdrMetaDiaria;
      metaAjustada = (payout as any).meta_agendadas_ajustada ?? (sdrMetaDiaria * diasUteisMes);
    } else if (metrica.nome_metrica === 'realizadas') {
      meta = kpi?.reunioes_agendadas || 0;
      metaAjustada = Math.round((kpi?.reunioes_agendadas || 0) * 0.7);
    } else if (metrica.nome_metrica === 'tentativas') {
      meta = 84;
      metaAjustada = (payout as any).meta_tentativas_ajustada ?? (84 * diasUteisMes);
    } else if (metrica.nome_metrica === 'organizacao') {
      meta = 100;
      metaAjustada = 100;
    }

    return (
      <SdrIndicatorCard
        title={metrica.label_exibicao}
        meta={meta}
        metaAjustada={metaAjustada}
        realizado={kpiValue}
        pct={pct}
        multiplicador={mult}
        valorBase={valorBase}
        valorFinal={valorFinal}
        isPercentage={config.isPercentage}
        isManual={!config.isAuto}
      />
    );
  }

  // For simpler metrics (contratos, r2_agendadas, outside_sales) - use a simple card
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Icon className={`h-4 w-4 ${colorClasses.split(' ')[0]}`} />
            {metrica.label_exibicao}
          </div>
          <Badge variant="outline" className={`text-[10px] ${colorClasses}`}>
            {config.autoSource}
          </Badge>
        </div>
        <div className={`text-2xl font-bold ${colorClasses.split(' ')[0]}`}>
          {kpiValue}
        </div>
        {metrica.peso_percentual && (
          <div className="text-xs text-muted-foreground mt-1">
            Peso: {metrica.peso_percentual}%
          </div>
        )}
        {metrica.meta_valor && (
          <div className="text-xs text-muted-foreground">
            Meta: {metrica.meta_valor}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Component to render a grid of dynamic indicators
interface DynamicIndicatorsGridProps {
  metricas: ActiveMetric[];
  kpi: SdrMonthKpi | null;
  payout: SdrMonthPayout;
  compPlan: SdrCompPlan | null;
  diasUteisMes: number;
  sdrMetaDiaria: number;
  variavelTotal?: number;
}

export const DynamicIndicatorsGrid = ({
  metricas,
  kpi,
  payout,
  compPlan,
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
          compPlan={compPlan}
          diasUteisMes={diasUteisMes}
          sdrMetaDiaria={sdrMetaDiaria}
          variavelTotal={variavelTotal}
        />
      ))}
    </div>
  );
};
