import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Users, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface DistributionResult {
  deal_id: string;
  deal_name: string;
  contact_email: string;
  assigned_to: string | null;
  success: boolean;
  error?: string;
}

interface DistributionResponse {
  success: boolean;
  dry_run: boolean;
  total_checked: number;
  outside_found: number;
  distributed: number;
  failed?: number;
  results: DistributionResult[];
  message: string;
  error?: string;
}

async function callDistributeOutside(dryRun: boolean): Promise<DistributionResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/distribute-outside-leads`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    },
    body: JSON.stringify({ dry_run: dryRun, only_no_owner: true }),
  });

  return res.json();
}

export const OutsideDistributionButton = () => {
  const [open, setOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [response, setResponse] = useState<DistributionResponse | null>(null);
  const queryClient = useQueryClient();

  const runDryRun = async () => {
    setIsDryRun(true);
    setIsRunning(true);
    setResponse(null);
    try {
      const data = await callDistributeOutside(true);
      setResponse(data);
    } catch (err) {
      console.error('[OutsideDistribution] Erro no dry run:', err);
      toast.error('Erro ao analisar leads Outside');
    } finally {
      setIsRunning(false);
    }
  };

  const handleOpen = () => {
    setResponse(null);
    setOpen(true);
    setTimeout(runDryRun, 100);
  };

  const handleConfirmDistribute = async () => {
    setIsDryRun(false);
    setIsRunning(true);
    setResponse(null);
    try {
      const data = await callDistributeOutside(false);
      setResponse(data);
      if (data.success && data.distributed > 0) {
        toast.success(`${data.distributed} leads Outside distribuídos com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      } else if (!data.success) {
        toast.error(data.error || data.message || 'Erro ao distribuir leads');
      } else if (data.distributed === 0) {
        toast.info('Nenhum lead foi distribuído');
      }
    } catch (err) {
      toast.error('Erro ao chamar a função de distribuição');
    } finally {
      setIsRunning(false);
    }
  };

  const showConfirmButton = response?.dry_run && (response?.outside_found ?? 0) > 0 && response?.success;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="flex-1 sm:flex-none gap-1"
        title="Distribuir leads Outside sem responsável"
      >
        <Users className="h-4 w-4" />
        <span className="hidden sm:inline">Distribuir Outsides</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Distribuição de Leads Outside
            </DialogTitle>
            <DialogDescription>
              Leads que pagaram contrato mas não fizeram R1 e estão sem responsável serão distribuídos automaticamente pela fila de SDRs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Loading */}
            {isRunning && (
              <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{isDryRun ? 'Analisando leads Outside...' : 'Distribuindo leads...'}</span>
              </div>
            )}

            {/* Resultado */}
            {!isRunning && response && (
              <div className="space-y-3">
                {/* Resumo */}
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deals verificados:</span>
                    <span className="font-medium">{response.total_checked}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Leads Outside encontrados:</span>
                    <span className="font-medium">{response.outside_found}</span>
                  </div>
                  {!response.dry_run && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Distribuídos:</span>
                        <span className="font-medium text-primary">{response.distributed}</span>
                      </div>
                      {(response.failed ?? 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Falhas:</span>
                          <span className="font-medium text-destructive">{response.failed}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Mensagem de erro ou aviso */}
                {!response.success && (
                  <div className="flex gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{response.message}</span>
                  </div>
                )}

                {/* Lista de resultados */}
                {response.results && response.results.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {response.dry_run ? 'Preview da distribuição' : 'Resultado da distribuição'}
                    </p>
                    {response.results.map((r) => (
                      <div
                        key={r.deal_id}
                        className="flex items-start gap-2 text-xs p-2 rounded border bg-card"
                      >
                        {r.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.deal_name}</p>
                          <p className="text-muted-foreground truncate">{r.contact_email}</p>
                          {r.assigned_to && (
                            <p className="text-primary truncate">
                              {response.dry_run ? '→ ' : '✓ '}{r.assigned_to}
                            </p>
                          )}
                          {r.error && (
                            <p className="text-destructive">{r.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {response.outside_found === 0 && response.success && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border bg-muted/20">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Nenhum lead Outside sem responsável encontrado. Tudo em ordem!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isRunning}>
              Fechar
            </Button>

            {!isRunning && response && !showConfirmButton && response.success && (
              <Button variant="outline" onClick={runDryRun} disabled={isRunning}>
                Reanalisar
              </Button>
            )}

            {showConfirmButton && (
              <Button
                onClick={handleConfirmDistribute}
                disabled={isRunning}
              >
                <Users className="h-4 w-4 mr-2" />
                Confirmar Distribuição ({response.outside_found})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
