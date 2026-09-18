import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/formatters';
import type { TotaisCliente } from '@/hooks/useTotaisPorCliente';

/**
 * Badge discreto com o LÍQUIDO já comprado pelo lead (todas as BUs).
 * Sem compra → não renderiza nada (nunca "R$ 0,00").
 */
export function LeadTotalCompradoBadge({
  totais,
  className,
}: {
  totais?: TotaisCliente | null;
  className?: string;
}) {
  const valor = totais?.total_liquido_pago ?? 0;
  if (!totais || valor <= 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 font-semibold gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 ${className || ''}`}
        >
          {totais.tem_reembolso && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
          )}
          {formatCurrency(valor)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {totais.tem_reembolso
          ? 'tem reembolso'
          : `Já comprou ${totais.qtd_produtos} produto(s) — líquido total`}
      </TooltipContent>
    </Tooltip>
  );
}
