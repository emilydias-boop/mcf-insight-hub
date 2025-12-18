import { Link } from "react-router-dom";
import { AlertTriangle, Ghost, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useGhostAuditStats } from "@/hooks/useGhostAppointments";

export function GhostAppointmentsAlert() {
  const { data: stats, isLoading } = useGhostAuditStats();

  if (isLoading || !stats || stats.pending === 0) {
    return null;
  }

  const hasCritical = stats.critical > 0;
  const hasHigh = stats.high > 0;

  return (
    <Alert 
      variant="destructive" 
      className={`border ${hasCritical ? 'border-red-500 bg-red-500/10' : hasHigh ? 'border-amber-500 bg-amber-500/10' : 'border-yellow-500 bg-yellow-500/10'}`}
    >
      <Ghost className={`h-5 w-5 ${hasCritical ? 'text-red-400' : 'text-amber-400'}`} />
      <AlertTitle className="flex items-center gap-2">
        <span className={hasCritical ? 'text-red-400' : 'text-amber-400'}>
          {stats.pending} caso{stats.pending !== 1 ? 's' : ''} de agendamento fantasma pendente{stats.pending !== 1 ? 's' : ''}
        </span>
        {hasCritical && (
          <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
            {stats.critical} crítico{stats.critical !== 1 ? 's' : ''}
          </span>
        )}
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
        <span className="text-muted-foreground text-sm">
          {stats.confirmed_fraud} fraude{stats.confirmed_fraud !== 1 ? 's' : ''} confirmada{stats.confirmed_fraud !== 1 ? 's' : ''} • 
          {" "}{stats.false_positive} falso{stats.false_positive !== 1 ? 's' : ''} positivo{stats.false_positive !== 1 ? 's' : ''}
        </span>
        <Button variant="outline" size="sm" asChild className="w-fit">
          <Link to="/crm/auditoria-agendamentos">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Ver Auditoria
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
