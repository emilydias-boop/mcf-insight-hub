import { useNavigate } from 'react-router-dom';
import { TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, AlertTriangle } from 'lucide-react';
import { SdrStatusBadge } from '@/components/sdr-fechamento/SdrStatusBadge';
import { formatCurrency } from '@/lib/formatters';

interface PayoutTableRowProps {
  payout: any;
  compPlan: any;
  anoMes: string;
  effectiveBu: string;
  selectedMonth: string;
  nivel: number;
  ote: number;
  buInfo: { label: string; isFromHR: boolean; hasWarning: boolean };
  roleLabel: string;
  roleType: string;
}

export function PayoutTableRow({
  payout,
  compPlan,
  anoMes,
  effectiveBu,
  selectedMonth,
  nivel,
  ote,
  buInfo,
  roleLabel,
  roleType,
}: PayoutTableRowProps) {
  const navigate = useNavigate();

  const isProporcional = payout.dias_uteis_trabalhados != null && 
    payout.dias_uteis_trabalhados < (payout.dias_uteis_mes || 22);

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-1.5">
          {payout.sdr?.name || 'SDR'}
          {isProporcional && (
            <Badge variant="outline" className="text-[9px] h-4 border-yellow-500 text-yellow-500">
              {payout.dias_uteis_trabalhados}d
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={roleType === 'closer' ? 'secondary' : 'outline'} className="font-normal">
          {roleLabel}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <div
          className="flex items-center justify-center gap-1"
          title={buInfo.hasWarning ? 'SDR sem vínculo RH' : undefined}
        >
          <span className={`text-sm ${buInfo.isFromHR ? 'text-foreground' : 'text-muted-foreground'}`}>
            {buInfo.label}
          </span>
          {buInfo.hasWarning && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="font-mono">
          N{nivel}
        </Badge>
      </TableCell>
      <TableCell className="text-right">{formatCurrency(ote)}</TableCell>
      <TableCell className="text-right">{formatCurrency(payout.valor_variavel_total || 0)}</TableCell>
      <TableCell className="text-right font-semibold">{formatCurrency(payout.total_conta || 0)}</TableCell>
      <TableCell className="text-right">{formatCurrency(payout.total_ifood || 0)}</TableCell>
      <TableCell className="text-center">
        <SdrStatusBadge status={payout.status} />
      </TableCell>
      <TableCell className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/fechamento-sdr/${payout.id}?from=${selectedMonth}&bu=${effectiveBu}`)}
        >
          <Eye className="h-4 w-4 mr-1" />
          Ver
        </Button>
      </TableCell>
    </TableRow>
  );
}
