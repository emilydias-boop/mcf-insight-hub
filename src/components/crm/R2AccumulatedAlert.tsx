import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface R2AccumulatedAlertProps {
  totalCount: number;
  proximaSemanaCount: number;
  semR2Count: number;
  onGoToTab: () => void;
}

export function R2AccumulatedAlert({
  totalCount,
  proximaSemanaCount,
  semR2Count,
  onGoToTab,
}: R2AccumulatedAlertProps) {
  if (totalCount === 0) return null;

  const parts: string[] = [];
  if (proximaSemanaCount > 0) parts.push(`${proximaSemanaCount} próxima semana`);
  if (semR2Count > 0) parts.push(`${semR2Count} sem R2`);

  return (
    <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800 dark:text-orange-300">
        {totalCount} lead(s) acumulado(s) de semanas anteriores
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span className="text-orange-700 dark:text-orange-400">
          {parts.join(' + ')} — precisam de atenção
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onGoToTab}
          className="border-orange-400 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950"
        >
          Ver acumulados
        </Button>
      </AlertDescription>
    </Alert>
  );
}
