import { useRef, useEffect, useCallback } from 'react';
import { QueueDeal } from '@/hooks/useSDRCockpit';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Loader2 } from 'lucide-react';

interface CockpitQueueProps {
  deals: QueueDeal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
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

export function CockpitQueue({ deals, selectedId, onSelect, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage }: CockpitQueueProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, {
      root: scrollRef.current,
      rootMargin: '200px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

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

  const headerLabel = hasNextPage
    ? `Fila (${deals.length} carregados…)`
    : `Fila (${deals.length})`;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#1e2130]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {headerLabel}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
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
        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
