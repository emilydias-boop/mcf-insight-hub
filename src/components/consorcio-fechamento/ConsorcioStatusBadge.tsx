import { Badge } from '@/components/ui/badge';
import { ConsorcioPayoutStatus, CONSORCIO_STATUS_LABELS } from '@/types/consorcio-fechamento';

interface ConsorcioStatusBadgeProps {
  status: ConsorcioPayoutStatus;
}

export function ConsorcioStatusBadge({ status }: ConsorcioStatusBadgeProps) {
  const config = CONSORCIO_STATUS_LABELS[status] || CONSORCIO_STATUS_LABELS.DRAFT;

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
