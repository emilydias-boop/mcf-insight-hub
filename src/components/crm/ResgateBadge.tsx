import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LifeBuoy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Selo "Resgate" (crm_deals.resgate_em).
 * Marca o lead que fez a R1, não comprou contrato e foi transferido para o
 * Rodrigo (coluna "Follow-up Closer"). É um selo À PARTE do A/B/C
 * (icp_segment), que continua funcionando exatamente como antes.
 * A coluna nunca é limpa, então o selo é permanente.
 */
interface ResgateBadgeProps {
  resgateEm?: string | null;
  className?: string;
}

export function ResgateBadge({ resgateEm, className }: ResgateBadgeProps) {
  if (!resgateEm) return null;

  return (
    <Badge
      variant="outline"
      title={`Resgate desde ${format(new Date(resgateEm), 'dd/MM/yyyy', { locale: ptBR })}`}
      className={cn(
        'text-[10px] px-1.5 py-0 gap-0.5 bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-700',
        className,
      )}
    >
      <LifeBuoy className="h-2.5 w-2.5" />
      Resgate
    </Badge>
  );
}
