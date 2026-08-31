import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SonaxCampaign {
  id: string;
  sonax_campaign_id: string | null;
  descricao: string;
  status: string;
  created_by: string | null;
  created_at: string;
}

export interface SonaxCampaignContact {
  id: string;
  campaign_id: string;
  deal_id: string | null;
  contact_phone: string | null;
  sonax_id_contato_campanha: string | null;
  tabulacao: string | null;
  status: string;
  created_at: string;
}

type Action =
  | 'criar_campanha'
  | 'chamada'
  | 'play_campanha'
  | 'stop_campanha'
  | 'status_chamadas_na_fila'
  | 'status_chamadas_andamento'
  | 'lista_tabulacao'
  | 'diagnostico';

export async function callSonaxProxy<T = any>(action: Action, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('sonax-campaign-proxy', {
    body: { action, payload },
  });

  if (error) {
    let code = '';
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        code = body?.error || '';
      }
    } catch { /* ignore */ }
    throw new Error(code || error.message || 'erro_desconhecido');
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

const todayLabel = () => new Date().toLocaleDateString('pt-BR');

/** Campanhas criadas hoje */
export function useSonaxCampaignsToday() {
  return useQuery({
    queryKey: ['sonax-campaigns-today'],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('sonax_campaigns')
        .select('*')
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SonaxCampaign[];
    },
  });
}

export function useSonaxCampaignContacts(campaignId?: string) {
  return useQuery({
    queryKey: ['sonax-campaign-contacts', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sonax_campaign_contacts')
        .select('*')
        .eq('campaign_id', campaignId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SonaxCampaignContact[];
    },
  });
}

/** Envia leads selecionados para o discador (cria/reaproveita campanha do dia da BU) */
export function useSendDealsToDialer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      args: string[] | { dealIds: string[]; bu?: string; onProgress?: (enviados: number, total: number) => void },
    ) => {
      const dealIds = Array.isArray(args) ? args : args.dealIds;
      const bu = Array.isArray(args) ? undefined : args.bu;
      const onProgress = Array.isArray(args) ? undefined : args.onProgress;
      if (!dealIds.length) throw new Error('nenhum_lead_selecionado');

      const descricao = bu
        ? `Discador ${bu} - ${todayLabel()}`
        : `Discador SDR - ${todayLabel()}`;

      // 1) Reaproveita campanha ativa do dia — apenas da mesma descrição (mesma BU)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data: existing } = await supabase
        .from('sonax_campaigns')
        .select('*')
        .gte('created_at', start.toISOString())
        .eq('status', 'ativa')
        .eq('descricao', descricao)
        .not('sonax_campaign_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      let campaign = (existing?.[0] as SonaxCampaign | undefined) ?? undefined;

      if (!campaign) {
        const res = await callSonaxProxy<{ campanha: SonaxCampaign }>('criar_campanha', {
          descricao,
          ...(bu ? { bu } : {}),
        });
        campaign = res.campanha;
      }
      if (!campaign?.id) throw new Error('falha_ao_criar_campanha');

      // 2) Envia cada lead
      let enviados = 0;
      const falhas: string[] = [];
      for (const dealId of dealIds) {
        try {
          await callSonaxProxy('chamada', { campaign_id: campaign.id, deal_id: dealId });
          enviados++;
        } catch (e) {
          falhas.push((e as Error).message);
        }
        onProgress?.(enviados + falhas.length, dealIds.length);
      }

      return { campaign, enviados, falhas, total: dealIds.length };
    },

    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sonax-campaigns-today'] });
      queryClient.invalidateQueries({ queryKey: ['sonax-campaign-contacts'] });
      if (res.enviados === res.total) {
        toast.success(`${res.enviados} lead(s) enviados para o discador`);
      } else if (res.enviados > 0) {
        toast.warning(`${res.enviados} de ${res.total} leads enviados. ${res.falhas.length} falharam (telefone inválido ou erro Sonax).`);
      } else {
        toast.error('Nenhum lead pôde ser enviado ao discador');
      }
    },
    onError: (err: Error) => {
      if (err.message === 'nenhum_lead_selecionado') toast.error('Selecione ao menos um lead');
      else toast.error(`Erro ao enviar para o discador: ${err.message}`);
    },
  });
}

export function useSonaxCampaignControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, play }: { campaignId: string; play: boolean }) =>
      callSonaxProxy(play ? 'play_campanha' : 'stop_campanha', { campaign_id: campaignId }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['sonax-campaigns-today'] });
      toast.success(vars.play ? 'Campanha iniciada' : 'Campanha parada');
    },
    onError: (err: Error) => toast.error(`Erro na campanha: ${err.message}`),
  });
}

/** Polling do status das chamadas */
export function useSonaxCallStatus(campaignId?: string, intervalMs = 15000) {
  return useQuery({
    queryKey: ['sonax-call-status', campaignId],
    enabled: !!campaignId,
    refetchInterval: intervalMs,
    queryFn: async () => {
      const [fila, andamento] = await Promise.all([
        callSonaxProxy('status_chamadas_na_fila', { campaign_id: campaignId }).catch((e) => ({ error: String(e) })),
        callSonaxProxy('status_chamadas_andamento', { campaign_id: campaignId }).catch((e) => ({ error: String(e) })),
      ]);
      return { fila, andamento };
    },
  });
}

export function useSonaxTabulacoes() {
  return useQuery({
    queryKey: ['sonax-tabulacoes'],
    staleTime: 10 * 60 * 1000,
    queryFn: () => callSonaxProxy<{ tabulacoes: Array<{ id: string; nome: string; grupo: string }> }>('lista_tabulacao'),
  });
}
