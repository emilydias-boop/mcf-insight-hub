import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Code2, AlertTriangle } from "lucide-react";

// DESATIVADO 05/04/2026 - Clint integração encerrada
// Leads chegam via Hubla webhook direto. Clint estava gerando duplicatas por race condition.

export function CronJobSetup() {
  // DESATIVADO 05/04/2026 - Clint integração encerrada
  // const scheduleSQL = `SELECT cron.schedule(...)`;
  // const unscheduleSQL = `SELECT cron.unschedule('sync-clint-full-auto')`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="h-5 w-5" />
          Sincronização Automática
        </CardTitle>
        <CardDescription>
          Cron job de sincronização com Clint CRM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-medium">⛔ Integração Clint encerrada em 05/04/2026</p>
            <p className="text-sm">
              Todos os leads já chegam via webhook direto da Hubla. 
              A integração com o Clint foi desativada pois estava gerando duplicatas por race condition.
            </p>
            <p className="text-sm">
              O campo <code>clint_id</code> permanece nos contatos como referência histórica.
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
