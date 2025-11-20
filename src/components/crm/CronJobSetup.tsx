import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Code2, Copy, Check, Play, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CronJobSetup() {
  const [copiedSchedule, setCopiedSchedule] = useState(false);
  const [copiedUnschedule, setCopiedUnschedule] = useState(false);

  const scheduleSQL = `-- Criar cron job para sincronização automática (a cada 10 minutos)
SELECT cron.schedule(
  'sync-clint-full-auto',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/sync-clint-data',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);`;

  const unscheduleSQL = `-- Desativar cron job de sincronização
SELECT cron.unschedule('sync-clint-full-auto');`;

  const copyToClipboard = (text: string, type: 'schedule' | 'unschedule') => {
    navigator.clipboard.writeText(text);
    if (type === 'schedule') {
      setCopiedSchedule(true);
      setTimeout(() => setCopiedSchedule(false), 2000);
    } else {
      setCopiedUnschedule(true);
      setTimeout(() => setCopiedUnschedule(false), 2000);
    }
    toast.success("SQL copiado para área de transferência");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="h-5 w-5" />
          Configurar Sincronização Automática
        </CardTitle>
        <CardDescription>
          Configure o cron job para sincronizar 100k+ contatos automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="space-y-2">
            <p className="font-medium">⚡ Sistema Otimizado:</p>
            <ul className="text-sm space-y-1 ml-4 list-disc">
              <li>Processa <strong>20.000 contatos</strong> por execução (100 páginas)</li>
              <li>Velocidade: <strong>~2.000-3.000 contatos/minuto</strong></li>
              <li>Execução: <strong>a cada 10 minutos</strong></li>
              <li>Tempo estimado: <strong>~50 minutos</strong> para 100k contatos</li>
              <li>Sistema de checkpoint: retoma de onde parou em caso de erro</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Play className="h-4 w-4 text-green-600" />
                1. Ativar Sincronização Automática
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(scheduleSQL, 'schedule')}
              >
                {copiedSchedule ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar SQL
                  </>
                )}
              </Button>
            </div>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
              <code>{scheduleSQL}</code>
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Square className="h-4 w-4 text-destructive" />
                2. Desativar após conclusão (opcional)
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(unscheduleSQL, 'unschedule')}
              >
                {copiedUnschedule ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar SQL
                  </>
                )}
              </Button>
            </div>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
              <code>{unscheduleSQL}</code>
            </pre>
          </div>
        </div>

        <Alert>
          <AlertDescription className="text-xs space-y-2">
            <p className="font-medium">📋 Instruções:</p>
            <ol className="ml-4 space-y-1 list-decimal">
              <li>Copie o SQL de ativação acima</li>
              <li>Acesse o <a href="https://supabase.com/dashboard/project/rehcfgqvigfcekiipqkc/sql/new" target="_blank" rel="noopener noreferrer" className="text-primary underline">SQL Editor do Supabase</a></li>
              <li>Cole e execute o SQL</li>
              <li>Aguarde ~50min para sincronização completa de 100k contatos</li>
              <li>Monitore o progresso no card "Monitor de Sincronização" acima</li>
              <li>Após conclusão, execute o SQL de desativação (ou mantenha para sync diário)</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
