import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  UserX, 
  XCircle, 
  CalendarClock, 
  UserMinus, 
  TrendingDown,
  CheckCircle,
  ShoppingBag,
  Percent,
  Bell,
  Loader2,
  RefreshCcw,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useR2MetricsData } from '@/hooks/useR2MetricsData';
import { useSDRR2Metrics } from '@/hooks/useSDRR2Metrics';
import { SemiCircleGauge } from './SemiCircleGauge';
import { AddExternalSaleModal } from './AddExternalSaleModal';
import { getCustomWeekStart, getCustomWeekEnd } from '@/lib/dateHelpers';

interface R2MetricsPanelProps {
  weekDate: Date;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
}

function MetricCard({ icon, label, value, color, badge, onClick }: MetricCardProps) {
  return (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: color ? `${color}20` : 'hsl(var(--muted))' }}
          >
            <div style={{ color: color || 'hsl(var(--muted-foreground))' }}>
              {icon}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {badge}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function R2MetricsPanel({ weekDate }: R2MetricsPanelProps) {
  const weekStart = getCustomWeekStart(weekDate);
  const { data: metrics, isLoading } = useR2MetricsData(weekDate);
  const { data: sdrMetrics, isLoading: sdrLoading } = useSDRR2Metrics(weekDate);

  const handleRescheduleNoShows = () => {
    window.location.href = '/crm/agenda-r2?filter=no_show';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Erro ao carregar métricas
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with week label */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Métricas do Carrinho - {format(weekStart, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        <AddExternalSaleModal weekStart={weekStart} />
      </div>

      {/* Seção 1: Leads do Carrinho */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Leads do Carrinho
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          <MetricCard
            icon={<Users className="h-5 w-5" />}
            label="Total Leads"
            value={metrics.totalLeads}
            color="#3B82F6"
          />
          <MetricCard
            icon={<UserX className="h-5 w-5" />}
            label="Desistentes"
            value={metrics.desistentes}
            color="#9333EA"
          />
          <MetricCard
            icon={<RefreshCcw className="h-5 w-5" />}
            label="Reembolsos"
            value={metrics.reembolsos}
            color="#EF4444"
          />
          <MetricCard
            icon={<XCircle className="h-5 w-5" />}
            label="Reprovados"
            value={metrics.reprovados}
            color="#DC2626"
          />
          <MetricCard
            icon={<CalendarClock className="h-5 w-5" />}
            label="Próx. Semana"
            value={metrics.proximaSemana}
            color="#F97316"
            badge={
              metrics.proximaSemana > 0 && (
                <Badge variant="outline" className="text-xs bg-orange-100/80 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200 border-orange-300 dark:border-orange-700">
                  Atenção
                </Badge>
              )
            }
          />
          <MetricCard
            icon={<UserMinus className="h-5 w-5" />}
            label="No-Show"
            value={metrics.noShow}
            color="#EF4444"
            badge={
              metrics.noShow > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRescheduleNoShows();
                  }}
                >
                  <Bell className="h-3 w-3" />
                  Reagendar
                </Button>
              )
            }
            onClick={metrics.noShow > 0 ? handleRescheduleNoShows : undefined}
          />
          <MetricCard
            icon={<TrendingDown className="h-5 w-5" />}
            label="Perdidos"
            value={`${metrics.leadsPerdidosPercent.toFixed(2)}%`}
            color={metrics.leadsPerdidosPercent > 30 ? '#DC2626' : '#6B7280'}
          />
        </div>
      </div>

      {/* Seção 2: Conversão do Carrinho */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Conversão do Carrinho
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MetricCard
            icon={<CheckCircle className="h-5 w-5" />}
            label="Selecionados"
            value={metrics.selecionados}
            color="#10B981"
          />
          <MetricCard
            icon={<ShoppingBag className="h-5 w-5" />}
            label="Vendas"
            value={metrics.vendas}
            color="#059669"
            badge={
              metrics.vendasExtras > 0 && (
                <Badge variant="outline" className="text-xs">
                  +{metrics.vendasExtras} extras
                </Badge>
              )
            }
          />
          <MetricCard
            icon={<Percent className="h-5 w-5" />}
            label="Conversão Geral"
            value={`${metrics.conversaoGeral.toFixed(2)}%`}
            color={
              metrics.conversaoGeral >= 60 ? '#10B981' : 
              metrics.conversaoGeral >= 30 ? '#F59E0B' : '#EF4444'
            }
          />
        </div>
      </div>

      {/* Seção 3: Conversão Individual (Closers + SDRs unificados) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-5 w-5 text-muted-foreground" />
            Conversão Individual (R2 → Parceria)
          </CardTitle>
          <CardDescription>
            Taxa de conversão de leads aprovados que compraram parceria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Closers */}
          {metrics.closerConversions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Closers
              </h4>
              <div className="flex flex-wrap gap-4 justify-start">
                {metrics.closerConversions.map((closer) => (
                  <SemiCircleGauge
                    key={closer.closerId}
                    value={closer.conversion}
                    label={closer.closerName}
                    sublabel={`${closer.vendas} de ${closer.aprovados}`}
                    color={closer.closerColor}
                    size={100}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SDRs */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              SDRs
            </h4>
            {sdrLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !sdrMetrics || sdrMetrics.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <User className="h-6 w-6 mx-auto mb-1 opacity-50" />
                <p>Nenhum lead aprovado com SDR identificado</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 justify-start">
                {sdrMetrics.map((sdr) => (
                  <SemiCircleGauge
                    key={sdr.sdrEmail}
                    value={sdr.taxaConversao}
                    label={sdr.sdrName}
                    sublabel={`${sdr.vendasRealizadas} de ${sdr.leadsAprovados}`}
                    color="#3B82F6"
                    size={100}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Totais */}
          {(metrics.closerConversions.length > 0 || (sdrMetrics && sdrMetrics.length > 0)) && (
            <div className="pt-4 border-t border-border">
              <div className="flex flex-wrap gap-6 text-sm">
                {metrics.closerConversions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-muted-foreground">Closers:</span>
                    <span className="font-medium">
                      {metrics.closerConversions.reduce((acc, c) => acc + c.vendas, 0)} vendas / {metrics.closerConversions.reduce((acc, c) => acc + c.aprovados, 0)} aprovados
                    </span>
                  </div>
                )}
                {sdrMetrics && sdrMetrics.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="text-muted-foreground">SDRs:</span>
                    <span className="font-medium">
                      {sdrMetrics.reduce((acc, s) => acc + s.vendasRealizadas, 0)} vendas / {sdrMetrics.reduce((acc, s) => acc + s.leadsAprovados, 0)} aprovados
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty state quando não há nenhum dos dois */}
          {metrics.closerConversions.length === 0 && (!sdrMetrics || sdrMetrics.length === 0) && !sdrLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum lead aprovado nesta semana</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
