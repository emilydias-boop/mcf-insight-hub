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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

      {/* Seção 3: Conversão Individual dos Sócios */}
      {metrics.closerConversions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            Conversão Individual dos Sócios (R2 Closers)
          </h3>
          <div className="flex flex-wrap gap-4 justify-start">
            {metrics.closerConversions.map((closer) => (
              <SemiCircleGauge
                key={closer.closerId}
                value={closer.conversion}
                label={closer.closerName}
                sublabel={`${closer.vendas} de ${closer.aprovados}`}
                color={closer.closerColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for closers */}
      {metrics.closerConversions.length === 0 && metrics.selecionados > 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum closer com aprovados nesta semana</p>
          </CardContent>
        </Card>
      )}

      {/* Seção 4: Conversão por SDR */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            Conversão por SDR
          </CardTitle>
          <CardDescription>
            Leads aprovados que compraram parceria (atribuídos ao SDR original)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sdrLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !sdrMetrics || sdrMetrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum lead aprovado com SDR identificado nesta semana</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SDR</TableHead>
                  <TableHead className="text-center">Aprovados</TableHead>
                  <TableHead className="text-center">Vendas</TableHead>
                  <TableHead className="text-center">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sdrMetrics.map((sdr) => (
                  <TableRow key={sdr.sdrEmail}>
                    <TableCell className="font-medium">{sdr.sdrName}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                        {sdr.leadsAprovados}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                        {sdr.vendasRealizadas}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={sdr.taxaConversao >= 50 ? 'default' : 'secondary'}
                        className={sdr.taxaConversao >= 50 
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' 
                          : ''
                        }
                      >
                        {sdr.taxaConversao.toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total row */}
                {sdrMetrics.length > 1 && (
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell className="text-muted-foreground">Total</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-300">
                        {sdrMetrics.reduce((acc, s) => acc + s.leadsAprovados, 0)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-300">
                        {sdrMetrics.reduce((acc, s) => acc + s.vendasRealizadas, 0)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const totalAprovados = sdrMetrics.reduce((acc, s) => acc + s.leadsAprovados, 0);
                        const totalVendas = sdrMetrics.reduce((acc, s) => acc + s.vendasRealizadas, 0);
                        const taxaTotal = totalAprovados > 0 ? (totalVendas / totalAprovados) * 100 : 0;
                        return (
                          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            {taxaTotal.toFixed(0)}%
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
