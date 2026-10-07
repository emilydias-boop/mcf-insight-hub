import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RefundedBadgeProps {
  date?: string | null;
  className?: string;
}

/** Selo laranja "Reembolsado dd/MM" — só exibição. Não renderiza sem data. */
export function RefundedBadge({ date, className }: RefundedBadgeProps) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return (
    <Badge
      variant="outline"
      title={`Contrato reembolsado em ${format(d, 'dd/MM/yyyy')}`}
      className={cn(
        'text-[10px] px-1.5 py-0 h-4 whitespace-nowrap bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700',
        className,
      )}
    >
      Reembolsado {format(d, 'dd/MM')}
    </Badge>
  );
}

/** Lê custom_fields.contrato_reembolsado_em e monta o tooltip. */
export function contratoReembolsoInfo(cf: Record<string, unknown> | null | undefined) {
  const em = cf?.contrato_reembolsado_em as string | undefined;
  if (!em) return null;
  const d = new Date(em);
  const fonteRaw = String(cf?.contrato_reembolso_fonte ?? '').trim();
  const fonte = fonteRaw === 'mcf_pay' ? 'MCF Pay' : fonteRaw === 'hubla' ? 'Hubla' : fonteRaw || '—';
  const data = isNaN(d.getTime()) ? em : format(d, 'dd/MM/yyyy');
  return { tooltip: `Contrato reembolsado em ${data} via ${fonte}`, data, fonte };
}
