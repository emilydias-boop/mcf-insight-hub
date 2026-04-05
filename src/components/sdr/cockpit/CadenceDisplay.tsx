import { format, addHours, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CadenceDisplayProps {
  currentAttempt: number;
  lastAttemptDate?: string | null;
}

function calculateNextAttemptDates(fromDate: Date): Date[] {
  return [
    fromDate,                          // Attempt 1 - now
    addHours(fromDate, 2),             // Attempt 2 - +2h
    addDays(fromDate, 1),              // Attempt 3 - next day
    addDays(fromDate, 3),              // Attempt 4 - +2 days from attempt 3
    addDays(fromDate, 7),              // Attempt 5 - +4 days from attempt 4
  ];
}

export function CadenceDisplay({ currentAttempt, lastAttemptDate }: CadenceDisplayProps) {
  const baseDate = lastAttemptDate ? new Date(lastAttemptDate) : new Date();
  const dates = calculateNextAttemptDates(baseDate);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Cadência de tentativas
      </h4>
      <div className="space-y-1">
        {dates.map((date, i) => {
          const attemptNum = i + 1;
          const isDone = attemptNum <= currentAttempt;
          const isCurrent = attemptNum === currentAttempt + 1;
          
          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded text-xs',
                isCurrent && 'bg-[#1e2130]',
              )}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : isCurrent ? (
                <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
              )}
              <span className={cn(
                'flex-1',
                isDone ? 'text-gray-500 line-through' : isCurrent ? 'text-white' : 'text-gray-500'
              )}>
                Tentativa {attemptNum}
              </span>
              <span className={cn(
                'text-[10px]',
                isCurrent ? 'text-amber-400' : 'text-gray-600'
              )}>
                {format(date, "dd/MM HH:mm", { locale: ptBR })}
              </span>
            </div>
          );
        })}
      </div>
      {currentAttempt >= 5 && (
        <p className="text-[10px] text-red-400 mt-1">
          ⚠️ 15 dias sem contato → mover para Sem Interesse
        </p>
      )}
    </div>
  );
}
