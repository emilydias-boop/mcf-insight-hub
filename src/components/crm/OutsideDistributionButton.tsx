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
import { Users, CheckCircle2, XCircle, AlertCircle, Loader2, Plus } from 'lucide-react';
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

interface OrphanContract {
  email: string;
  name: string;
  sale_date: string;
  product_name: string;
}

interface DistributionResponse {
  success: boolean;
  dry_run: boolean;
  total_checked: number;
  outside_found: number;
  distributed: number;
  failed?: number;
  results: DistributionResult[];
  orphan_contracts?: OrphanContract[];
  no_contact_contracts?: OrphanContract[];
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
  const [creatingDeal, setCreatingDeal] = useState<string | null>(null);
  const [createdDeals, setCreatedDeals] = useState<Set<string>>(new Set());
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
    setCreatedDeals(new Set());
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

  const handleCreateDeal = async (orphan: OrphanContract) => {
    setCreatingDeal(orphan.email);
    try {
      // Create contact + deal via direct insert
      const { data: existingContact } = await supabase
        .from('crm_contacts')
        .select('id')
        .ilike('email', orphan.email)
        .maybeSingle();

      let contactId = existingContact?.id;

      if (!contactId) {
        const { data: newContact, error: contactErr } = await supabase
          .from('crm_contacts')
          .insert([{ clint_id: `orphan-${Date.now()}`, name: orphan.name, email: orphan.email.toLowerCase().trim() }])
          .select('id')
          .single();
        if (contactErr) throw contactErr;
        contactId = newContact.id;
      }

      // Get origin
      const { data: origins } = await supabase
        .from('crm_origins')
        .select('id')
        .ilike('name', '%PIPELINE INSIDE SALES%')
        .limit(1);

      const originId = origins?.[0]?.id || 'e3c04f21-7b9a-4c2d-8f1e-5a3b7c9d2e4f';

      // Get first stage
      const { data: stages } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('origin_id', originId)
        .order('order_index', { ascending: true })
        .limit(1);

      const stageId = stages?.[0]?.id;

      // Check if deal already exists
      const { data: existingDeal } = await supabase
        .from('crm_deals')
        .select('id')
        .eq('contact_id', contactId)
        .eq('origin_id', originId)
        .maybeSingle();

      if (existingDeal) {
        toast.info('Deal já existe para este contato');
        setCreatedDeals(prev => new Set(prev).add(orphan.email));
        return;
      }

      const { error: dealErr } = await supabase
        .from('crm_deals')
        .insert({
          clint_id: `orphan-fix-${Date.now()}`,
          name: `${orphan.name} - A010`,
          contact_id: contactId,
          origin_id: originId,
          stage_id: stageId,
          tags: ['A010', 'Hubla', 'Outside', 'orphan-fix'],
          data_source: 'manual',
        });

      if (dealErr) throw dealErr;

      toast.success(`Deal criado para ${orphan.name}`);
      setCreatedDeals(prev => new Set(prev).add(orphan.email));
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    } catch (err: any) {
      console.error('[OutsideDistribution] Erro ao criar deal:', err);
      toast.error(`Erro ao criar deal: ${err.message}`);
    } finally {
      setCreatingDeal(null);
    }
  };

  const showConfirmButton = response?.dry_run && (response?.outside_found ?? 0) > 0 && response?.success;
  const allOrphans = [
    ...(response?.orphan_contracts || []),
    ...(response?.no_contact_contracts || []),
  ];

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
            {isRunning && (
              <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{isDryRun ? 'Analisando leads Outside...' : 'Distribuindo leads...'}</span>
              </div>
            )}

            {!isRunning && response && (
              <div className="space-y-3">
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

                {!response.success && (
                  <div className="flex gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{response.message}</span>
                  </div>
                )}

                {response.results && response.results.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {response.dry_run ? 'Preview da distribuição' : 'Resultado da distribuição'}
                    </p>
                    {response.results.map((r) => (
                      <div key={r.deal_id} className="flex items-start gap-2 text-xs p-2 rounded border bg-card">
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
                          {r.error && <p className="text-destructive">{r.error}</p>}
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

                {/* Orphan Contracts Section */}
                {allOrphans.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-2 p-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-sm">
                      <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                      <span className="text-yellow-700 dark:text-yellow-400">
                        {allOrphans.length} contrato(s) sem deal no CRM detectado(s). Verifique e crie manualmente se necessário.
                      </span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Contratos órfãos (últimos 30 dias)
                      </p>
                      {allOrphans.map((o) => (
                        <div key={o.email} className="flex items-center gap-2 text-xs p-2 rounded border bg-card">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{o.name}</p>
                            <p className="text-muted-foreground truncate">{o.email}</p>
                            <p className="text-muted-foreground">
                              {new Date(o.sale_date).toLocaleDateString('pt-BR')} · {o.product_name}
                            </p>
                          </div>
                          {createdDeals.has(o.email) ? (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs shrink-0"
                              disabled={creatingDeal === o.email}
                              onClick={() => handleCreateDeal(o)}
                            >
                              {creatingDeal === o.email ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Criar Deal
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
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
              <Button onClick={handleConfirmDistribute} disabled={isRunning}>
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
