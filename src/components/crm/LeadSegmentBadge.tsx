import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Badge de segmento ICP do lead (crm_deals.icp_segment).
 * A = dentro do ICP, B = fora do ICP, C = construir para morar.
 * Qualquer outro valor (ou vazio) não renderiza nada.
 */
interface LeadSegmentBadgeProps {
  segment?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

const CONFIG: Record<string, { label: string; color: string; title: string }> = {
  A: { label: 'Lead A', color: 'bg-green-600 hover:bg-green-600', title: 'Dentro do ICP' },
  B: { label: 'Lead B', color: 'bg-amber-500 hover:bg-amber-500', title: 'Fora do ICP' },
  C: { label: 'Lead C', color: 'bg-blue-600 hover:bg-blue-600', title: 'Construir para morar' },
};

export function LeadSegmentBadge({ segment, size = 'md', className }: LeadSegmentBadgeProps) {
  const key = (segment ?? '').toString().trim().toUpperCase();
  const cfg = CONFIG[key];
  if (!cfg) return null;

  return (
    <Badge
      title={cfg.title}
      className={cn(
        'border-0 text-white',
        size === 'sm' ? 'text-[9px] px-1 py-0' : 'text-[11px]',
        cfg.color,
        className,
      )}
    >
      {cfg.label}
    </Badge>
  );
}
