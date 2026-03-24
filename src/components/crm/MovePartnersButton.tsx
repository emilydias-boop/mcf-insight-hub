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
import { UserCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface MovePartnersResponse {
  success: boolean;
  dry_run: boolean;
  stats: {
    total_deals: number;
    deals_fora_vr: number;
    partner_emails: number;
    partner_deals_found: number;
    skipped_with_meetings: number;
    moved: number;
    errors: number;
  };
  details: Array<{
    deal_id: string;
    deal_name: string;
    email: string;
    action: string;
    error?: string;
  }>;
  error?: string;
}

async function callMovePartners(dryRun: boolean): Promise<MovePartnersResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/move-partners-to-venda-realizada`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    },
    body: JSON.stringify({ dry_run: dryRun }),
  });

  return res.json();
}

export const MovePartnersButton = () => {
  const [open, setOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [response, setResponse] = useState<MovePartnersResponse | null>(null);
  const queryClient = useQueryClient();

  const runDryRun = async () => {
    setIsDryRun(true);
    setIsRunning(true);
    setResponse(null);
    try {
      const data = await callMovePartners(true);
      setResponse(data);
    } catch {
      toast.error('Erro ao analisar parceiros');
    } finally {
      setIsRunning(false);
    }
  };

  const handleOpen = () => {
    setResponse(null);
    setOpen(true);
    setTimeout(runDryRun, 100);
  };

  const handleConfirm = async () => {
    setIsDryRun(false);
    setIsRunning(true);
    setResponse(null);
    try {
      const data = await callMovePartners(false);
      setResponse(data);
      if (data.success && data.stats.moved > 0) {
        toast.success(`${data.stats.moved} deals de parceiros movidos para Venda Realizada!`);
        queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      } else if (!data.success) {
        toast.error(data.error || 'Erro ao mover parceiros');
      } else if (data.stats.moved === 0) {
        toast.info('Nenhum deal de parceiro para mover');
      }
    } catch {
      toast.error('Erro ao executar movimentação');
    } finally {
      setIsRunning(false);
    }
  };

  const showConfirmButton = response?.dry_run && (response?.stats?.partner_deals_found ?? 0) > 0 && response?.success;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="flex-1 sm:flex-none gap-1"
        title="Mover deals de parceiros para Venda Realizada"
      >
        <UserCheck className="h-4 w-4" />
        <span className="hidden sm:inline">Mover Parceiros</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Mover Parceiros → Venda Realizada
            </DialogTitle>
            <DialogDescription>
              Identifica deals de contatos que já são parceiros (compraram A001, A009, etc.) e os move automaticamente para "Venda Realizada".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isRunning && (
              <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{isDryRun ? 'Analisando parceiros...' : 'Movendo deals...'}</span>
              </div>
            )}

            {!isRunning && response && (
              <div className="space-y-3">
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deals totais:</span>
                    <span className="font-medium">{response.stats.total_deals}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Emails de parceiros:</span>
                    <span className="font-medium">{response.stats.partner_emails}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deals de parceiros fora de VR:</span>
                    <span className="font-medium">{response.stats.partner_deals_found}</span>
                  </div>
                  {(response.stats.skipped_with_meetings ?? 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Protegidos (com reunião):</span>
                      <span className="font-medium text-orange-500">{response.stats.skipped_with_meetings}</span>
                    </div>
                  )}
                  {!response.dry_run && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Movidos:</span>
                        <span className="font-medium text-primary">{response.stats.moved}</span>
                      </div>
                      {response.stats.errors > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Erros:</span>
                          <span className="font-medium text-destructive">{response.stats.errors}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {response.details && response.details.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {response.dry_run ? 'Preview' : 'Resultado'}
                    </p>
                    {response.details.map((r) => (
                      <div key={r.deal_id} className="flex items-start gap-2 text-xs p-2 rounded border bg-card">
                        {r.action !== 'error' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.deal_name}</p>
                          <p className="text-muted-foreground truncate">{r.email}</p>
                          {r.error && <p className="text-destructive">{r.error}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {response.stats.partner_deals_found === 0 && response.success && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border bg-muted/20">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>Nenhum deal de parceiro fora de Venda Realizada. Tudo certo!</span>
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
              <Button onClick={handleConfirm} disabled={isRunning}>
                <UserCheck className="h-4 w-4 mr-2" />
                Confirmar Movimentação ({response.stats.partner_deals_found})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
