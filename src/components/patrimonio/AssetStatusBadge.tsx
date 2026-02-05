import { Badge } from '@/components/ui/badge';
import { AssetStatus, ASSET_STATUS_LABELS } from '@/types/patrimonio';
import { cn } from '@/lib/utils';

const statusColors: Record<AssetStatus, string> = {
  em_estoque: 'bg-green-500/20 text-green-400 border-green-500/30',
  em_uso: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  em_manutencao: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  devolvido: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  baixado: 'bg-red-500/20 text-red-400 border-red-500/30',
};

interface AssetStatusBadgeProps {
  status: AssetStatus;
  className?: string;
}

export const AssetStatusBadge = ({ status, className }: AssetStatusBadgeProps) => {
  return (
    <Badge 
      variant="outline" 
      className={cn(statusColors[status], className)}
    >
      {ASSET_STATUS_LABELS[status]}
    </Badge>
  );
};
