import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Clock, AlertTriangle, CheckCircle, XCircle, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { PagamentosKPIData } from '@/hooks/useConsorcioPagamentos';

interface Props {
  data: PagamentosKPIData;
  isLoading: boolean;
}

const kpiConfig = [
  { key: 'totalRecebido' as const, label: 'Total Recebido', icon: DollarSign, format: 'currency', color: 'text-green-600' },
  { key: 'totalPendente' as const, label: 'Total Pendente', icon: Clock, format: 'currency', color: 'text-yellow-600' },
  { key: 'totalAtraso' as const, label: 'Total em Atraso', icon: AlertTriangle, format: 'currency', color: 'text-destructive' },
  { key: 'parcelasPagas' as const, label: 'Parcelas Pagas', icon: CheckCircle, format: 'number', color: 'text-green-600' },
  { key: 'parcelasPendentes' as const, label: 'Parcelas Pendentes', icon: Clock, format: 'number', color: 'text-yellow-600' },
  { key: 'parcelasVencidas' as const, label: 'Parcelas Vencidas', icon: XCircle, format: 'number', color: 'text-destructive' },
  { key: 'cotasInadimplentes' as const, label: 'Cotas Inadimplentes', icon: TrendingDown, format: 'number', color: 'text-destructive' },
  { key: 'cotasQuitadas' as const, label: 'Cotas Quitadas', icon: CheckCircle, format: 'number', color: 'text-green-600' },
];

export function PagamentosKPIs({ data, isLoading }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {kpiConfig.map(({ key, label, icon: Icon, format, color }) => (
        <Card key={key}>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className={`text-lg font-bold ${color}`}>
                {format === 'currency' ? formatCurrency(data[key]) : data[key].toLocaleString('pt-BR')}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
