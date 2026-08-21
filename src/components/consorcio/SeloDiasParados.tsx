import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Selo de "dias parados" das filas do Consórcio.
 *
 * Regra combinada: nada antes de 2 dias (alerta em tudo faz ninguém olhar para
 * nada), âmbar de 2 a 5 dias e vermelho a partir de 6 — assim o caso de 30 dias
 * não fica visualmente igual ao de 2.
 */
export const DIAS_PARADOS_MINIMO = 2;
export const DIAS_PARADOS_VERMELHO = 6;

/** Dias inteiros entre uma data-âncora (ISO ou YYYY-MM-DD) e hoje. */
export function diasDesde(iso?: string | null): number | null {
  if (!iso) return null;
  const base = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(base.getTime())) return null;
  const diff = Date.now() - base.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / 86_400_000);
}

export function SeloDiasParados({
  desde,
  dias,
  motivo,
  className,
}: {
  /** Data-âncora da contagem (ex.: scheduled_at, created_at). */
  desde?: string | null;
  /** Alternativa a `desde` quando o cálculo já foi feito fora. */
  dias?: number | null;
  /** Texto do tooltip explicando de onde a contagem parte. */
  motivo?: string;
  className?: string;
}) {
  const n = dias != null ? dias : diasDesde(desde);
  if (n == null || n < DIAS_PARADOS_MINIMO) return null;

  const tom =
    n >= DIAS_PARADOS_VERMELHO
      ? 'border-destructive/60 bg-destructive/10 text-destructive'
      : 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400';

  const selo = (
    <Badge
      variant="outline"
      className={cn('text-[10px] tabular-nums font-semibold', tom, motivo && 'cursor-help', className)}
    >
      {n} dia{n === 1 ? '' : 's'} parado
    </Badge>
  );

  if (!motivo) return selo;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{selo}</TooltipTrigger>
      <TooltipContent className="max-w-[260px]">
        <p className="text-xs">{motivo}</p>
      </TooltipContent>
    </Tooltip>
  );
}
