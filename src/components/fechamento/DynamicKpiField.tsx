import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ActiveMetric, METRIC_CONFIG } from '@/hooks/useActiveMetricsForSdr';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  Phone, 
  Zap, 
  AlertCircle,
} from 'lucide-react';

interface DynamicKpiFieldProps {
  metrica: ActiveMetric;
  value: number;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
  autoValue?: number; // Value from automatic source (Agenda, Twilio, etc.)
  metaDescription?: string;
}

export const DynamicKpiField = ({
  metrica,
  value,
  onChange,
  disabled = false,
  autoValue,
  metaDescription,
}: DynamicKpiFieldProps) => {
  const config = METRIC_CONFIG[metrica.nome_metrica];
  
  if (!config) {
    return null;
  }

  const isManual = !config.isAuto;
  const isPending = isManual && value === 0;
  const fieldName = config.kpiField;

  // Determine badge color and icon based on source
  const getBadgeConfig = () => {
    if (isManual) {
      return {
        variant: 'outline' as const,
        className: isPending ? 'border-yellow-500 text-yellow-500' : 'border-blue-500 text-blue-500',
        icon: null,
        label: 'Manual',
      };
    }

    switch (config.autoSource) {
      case 'Agenda':
        return {
          variant: 'outline' as const,
          className: 'border-green-500 text-green-500',
          icon: <Calendar className="h-2.5 w-2.5 mr-0.5" />,
          label: 'Auto (Agenda)',
        };
      case 'Twilio':
        return {
          variant: 'outline' as const,
          className: 'border-purple-500 text-purple-500',
          icon: <Phone className="h-2.5 w-2.5 mr-0.5" />,
          label: 'Auto (Twilio)',
        };
      case 'Hubla':
        return {
          variant: 'secondary' as const,
          className: '',
          icon: <Zap className="h-2.5 w-2.5 mr-0.5" />,
          label: 'Auto',
        };
      default:
        return {
          variant: 'secondary' as const,
          className: '',
          icon: <Zap className="h-2.5 w-2.5 mr-0.5" />,
          label: 'Auto',
        };
    }
  };

  const badgeConfig = getBadgeConfig();

  // For read-only auto fields from Hubla
  if (metrica.nome_metrica === 'contratos') {
    return (
      <div className="space-y-1">
        <Label className="flex items-center gap-1.5 text-xs">
          {metrica.label_exibicao}
          <Badge variant={badgeConfig.variant} className={cn("text-[10px] h-4", badgeConfig.className)}>
            {badgeConfig.icon}
            {badgeConfig.label}
          </Badge>
        </Label>
        <div className="h-8 px-3 py-1.5 rounded-md border bg-muted/50 flex items-center text-sm">
          <span className="font-medium">{value}</span>
          <span className="text-muted-foreground/70 text-[10px] ml-1.5">(calculado da Hubla)</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldName} className="flex items-center gap-1.5 text-xs">
        {metrica.label_exibicao}
        <Badge variant={badgeConfig.variant} className={cn("text-[10px] h-4", badgeConfig.className)}>
          {badgeConfig.icon}
          {badgeConfig.label}
        </Badge>
      </Label>
      {metaDescription && (
        <span className="text-[10px] text-muted-foreground/70 block">
          {metaDescription}
          {autoValue !== undefined && config.autoSource && (
            <span className={`ml-1 ${config.autoSource === 'Twilio' ? 'text-purple-500' : 'text-green-500'}`}>
              • {config.autoSource}: {autoValue}
            </span>
          )}
        </span>
      )}
      <Input
        id={fieldName}
        type="number"
        min="0"
        max={config.isPercentage ? 150 : undefined}
        value={value}
        onChange={(e) => onChange(fieldName, e.target.value)}
        disabled={disabled}
        className={cn(
          "h-8 text-sm",
          isPending && "border-yellow-500 focus-visible:ring-yellow-500"
        )}
        placeholder={isPending ? "Preencha" : undefined}
      />
    </div>
  );
};

// Component to render a grid of dynamic KPI fields
interface DynamicKpiFieldsGridProps {
  metricas: ActiveMetric[];
  formData: Record<string, number>;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
  agendaMetrics?: {
    r1_agendada: number;
    r1_realizada: number;
    no_shows: number;
    r2_agendadas?: number;
  } | null;
  callMetrics?: {
    totalCalls: number;
  } | null;
  sdrMetaDiaria?: number;
  diasUteisMes?: number;
}

export const DynamicKpiFieldsGrid = ({
  metricas,
  formData,
  onChange,
  disabled = false,
  agendaMetrics,
  callMetrics,
  sdrMetaDiaria = 10,
  diasUteisMes = 19,
}: DynamicKpiFieldsGridProps) => {
  const getMetaDescription = (nomeMetrica: string): string | undefined => {
    switch (nomeMetrica) {
      case 'agendamentos':
        return `Meta: ${sdrMetaDiaria * diasUteisMes} (${sdrMetaDiaria}/dia × ${diasUteisMes} dias)`;
      case 'realizadas':
        const agendadas = formData.reunioes_agendadas || 0;
        return `Meta: ${Math.round(agendadas * 0.7)} (70% de ${agendadas} agendadas)`;
      case 'tentativas':
        return `Meta: ${84 * diasUteisMes} (84/dia × ${diasUteisMes} dias)`;
      case 'organizacao':
        return `Meta: 100% (fixa)`;
      default:
        return undefined;
    }
  };

  const getAutoValue = (nomeMetrica: string): number | undefined => {
    switch (nomeMetrica) {
      case 'agendamentos':
        return agendaMetrics?.r1_agendada;
      case 'realizadas':
        return agendaMetrics?.r1_realizada;
      case 'no_show':
        return agendaMetrics?.no_shows;
      case 'tentativas':
        return callMetrics?.totalCalls;
      case 'r2_agendadas':
        return agendaMetrics?.r2_agendadas;
      default:
        return undefined;
    }
  };

  const getValue = (nomeMetrica: string): number => {
    const config = METRIC_CONFIG[nomeMetrica];
    if (!config) return 0;
    return formData[config.kpiField] || 0;
  };

  if (!metricas || metricas.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        Nenhuma métrica configurada.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {metricas.map((metrica) => (
        <DynamicKpiField
          key={metrica.nome_metrica}
          metrica={metrica}
          value={getValue(metrica.nome_metrica)}
          onChange={onChange}
          disabled={disabled}
          autoValue={getAutoValue(metrica.nome_metrica)}
          metaDescription={getMetaDescription(metrica.nome_metrica)}
        />
      ))}
    </div>
  );
};
