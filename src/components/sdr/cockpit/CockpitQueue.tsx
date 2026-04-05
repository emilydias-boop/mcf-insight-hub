import { QueueDeal } from '@/hooks/useSDRCockpit';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock } from 'lucide-react';

interface CockpitQueueProps {
  deals: QueueDeal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

function formatTimeInStage(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function getUrgencyColor(hours: number): string {
  if (hours < 2) return 'bg-green-500';
  if (hours < 24) return 'bg-amber-500';
  return 'bg-red-500';
}

export function CockpitQueue({ deals, selectedId, onSelect, isLoading, onLoadMore, hasMore }: CockpitQueueProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-16 rounded bg-[#1e2130] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!deals.length) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-gray-500">
        Nenhum lead na fila
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#1e2130]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Fila ({deals.length})
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {deals.map((deal) => (
          <button
            key={deal.id}
            onClick={() => onSelect(deal.id)}
            className={cn(
              'w-full text-left px-3 py-2.5 border-b border-[#1e2130] transition-colors',
              selectedId === deal.id
                ? 'bg-[#1e2130]'
                : 'hover:bg-[#161825]'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', getUrgencyColor(deal.hoursInStage))} />
              <span className="text-sm font-medium text-gray-200 truncate">
                {deal.contactName || deal.name}
              </span>
            </div>
            <div className="flex items-center justify-between pl-4">
              <span className="text-[10px] text-gray-500 truncate">{deal.stageName}</span>
              <div className="flex items-center gap-1.5">
                {deal.isOverdue && (
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                )}
                <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatTimeInStage(deal.hoursInStage)}
                </span>
              </div>
            </div>
          </button>
        ))}
        {hasMore && onLoadMore && (
          <button
            onClick={onLoadMore}
            className="w-full py-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver mais
          </button>
        )}
      </div>
    </div>
  );
}
