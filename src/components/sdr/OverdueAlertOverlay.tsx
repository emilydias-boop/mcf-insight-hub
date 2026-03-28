import { useState, useEffect, useCallback } from 'react';
import { usePendingNextActions } from '@/hooks/usePendingNextActions';
import { useOverdueAlertSound } from '@/hooks/useOverdueAlertSound';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';

const SNOOZE_MS = 2 * 60 * 1000; // 2 minutes

export const OverdueAlertOverlay = () => {
  const { role } = useAuth();
  const { data: actions = [] } = usePendingNextActions();
  const overdueCount = actions.filter(a => a.isOverdue).length;
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Sound alert (respects dismiss)
  const effectiveOverdue = isDismissed ? 0 : overdueCount;
  useOverdueAlertSound(effectiveOverdue);

  // Auto-restore after snooze
  useEffect(() => {
    if (!isDismissed) return;
    const timer = setTimeout(() => setIsDismissed(false), SNOOZE_MS);
    return () => clearTimeout(timer);
  }, [isDismissed]);

  // Only show for SDR role
  if (role !== 'sdr') return null;
  if (overdueCount === 0 || isDismissed) return null;

  const handleClick = () => {
    if (location.pathname === '/sdr/minhas-reunioes') {
      const el = document.getElementById('pending-actions-panel');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/sdr/minhas-reunioes');
    }
  };

  const handleSnooze = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  return (
    <div
      onClick={handleClick}
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
      <button
        onClick={handleSnooze}
        className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors"
        title="Ignorar por 2 minutos"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
