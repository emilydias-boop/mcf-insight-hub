import { Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMonthLock } from "@/hooks/useMonthLock";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  /** YYYY-MM */
  anoMes: string | null;
  className?: string;
}

/**
 * Shows a banner when the given month is locked (fechamento aprovado).
 * Renders nothing when the month is open.
 */
export function MonthLockBanner({ anoMes, className }: Props) {
  const { data: lock } = useMonthLock(anoMes);

  if (!lock || !lock.is_active) return null;

  const lockedAt = lock.locked_at
    ? format(new Date(lock.locked_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  return (
    <Alert className={className} variant="default">
      <Lock className="h-4 w-4" />
      <AlertTitle>Mês {anoMes} fechado</AlertTitle>
      <AlertDescription>
        As reuniões deste mês estão travadas para alteração de status
        {lock.locked_reason ? ` (${lock.locked_reason})` : ""}
        {lockedAt ? ` desde ${lockedAt}` : ""}.
        Apenas Admin, Gestor ou Coordenador podem alterar ou reabrir o mês.
      </AlertDescription>
    </Alert>
  );
}