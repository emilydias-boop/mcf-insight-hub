import { usePendingNextActions } from '@/hooks/usePendingNextActions';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const OverdueAlertOverlay = () => {
  const { data: actions = [] } = usePendingNextActions();
  const overdueCount = actions.filter(a => a.isOverdue).length;

  if (overdueCount === 0) return null;

  const scrollToPanel = () => {
    const el = document.getElementById('pending-actions-panel');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      onClick={scrollToPanel}
      className={cn(
        "fixed bottom-6 right-6 z-50 cursor-pointer",
        "flex items-center gap-3 px-5 py-4 rounded-xl",
        "bg-destructive text-destructive-foreground shadow-2xl",
        "border-4 border-white/30",
        "animate-bounce",
        "hover:scale-105 transition-transform"
      )}
    >
      <AlertTriangle className="h-6 w-6 animate-pulse" />
      <div>
        <div className="font-bold text-sm">
          {overdueCount} AÇÃO{overdueCount > 1 ? 'ÕES' : ''} ATRASADA{overdueCount > 1 ? 'S' : ''}!
        </div>
        <div className="text-xs opacity-90">Clique para resolver</div>
      </div>
    </div>
  );
};
