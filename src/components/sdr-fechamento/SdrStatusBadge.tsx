import { Badge } from '@/components/ui/badge';
import { PayoutStatus } from '@/types/sdr-fechamento';

interface SdrStatusBadgeProps {
  status: PayoutStatus;
}

export const SdrStatusBadge = ({ status }: SdrStatusBadgeProps) => {
  const config = {
    DRAFT: {
      label: 'Rascunho',
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
    APPROVED: {
      label: 'Aprovado',
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    LOCKED: {
      label: 'Travado',
      className: 'bg-muted text-muted-foreground border-muted',
    },
  };

  const { label, className } = config[status] || config.DRAFT;

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
};
