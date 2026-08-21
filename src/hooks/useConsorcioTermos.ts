import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sha256Hex, type TermoDados } from '@/lib/consorcioTermo';

export interface ConsorcioTermoModelo {
  id: string;
  nome: string;
  conteudo: string;
  versao: number;
  ativo: boolean;
  tipo: TermoTipo;
  created_at: string;
  created_by: string | null;
}

export type TermoTipo = 'adesao' | 'comprovante_cadastro';

export const TERMO_TIPO_LABEL: Record<TermoTipo, string> = {
  adesao: 'Termo de Adesão',
  comprovante_cadastro: 'Comprovante de Cadastro',
};

export interface ConsorcioTermo {
  id: string;
  tipo: TermoTipo;
  pending_registration_id: string | null;
  proposal_id: string | null;
  deal_id: string | null;
  card_id: string | null;
  modelo_id: string | null;
  modelo_versao: number | null;
  access_token: string;
  conteudo_renderizado: string;
  conteudo_hash: string;
  status: 'pendente' | 'assinado' | 'expirado' | 'cancelado';
  expires_at: string;
  assinado_em: string | null;
  assinante_nome: string | null;
  assinante_cpf: string | null;
  assinante_ip: string | null;
  visualizado_em: string | null;
  visualizado_ip: string | null;
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  created_at: string;
}

const TERMO_SELECT =
  'id, tipo, pending_registration_id, proposal_id, deal_id, card_id, modelo_id, modelo_versao, access_token, conteudo_renderizado, conteudo_hash, status, expires_at, assinado_em, assinante_nome, assinante_cpf, assinante_ip, visualizado_em, visualizado_ip, cancelado_em, cancelado_motivo, created_at';

/** Modelos de um tipo de documento. `onlyAtivo` para o uso operacional (geração). */
export function useTermoModelos(onlyAtivo = false, tipo: TermoTipo = 'adesao') {
  return useQuery({
    queryKey: ['consorcio-termo-modelos', onlyAtivo, tipo],
    queryFn: async (): Promise<ConsorcioTermoModelo[]> => {
      let q = supabase
        .from('consorcio_termo_modelos')
        .select('id, nome, conteudo, versao, ativo, tipo, created_at, created_by')
        .eq('tipo', tipo)
        .order('versao', { ascending: false });
      if (onlyAtivo) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ConsorcioTermoModelo[];
    },
  });
}

/** Salva uma NOVA versão do modelo do tipo informado (nunca sobrescreve o texto anterior). */
export function useSaveTermoModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      nome,
      conteudo,
      tipo = 'adesao' as TermoTipo,
    }: { nome: string; conteudo: string; tipo?: TermoTipo }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: last } = await supabase
        .from('consorcio_termo_modelos')
        .select('versao')
        .eq('tipo', tipo)
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextVersao = Number((last as any)?.versao || 0) + 1;

      // desativa versões anteriores DO MESMO TIPO — os outros tipos não são tocados
      await supabase
        .from('consorcio_termo_modelos')
        .update({ ativo: false })
        .eq('ativo', true)
        .eq('tipo', tipo);

      const { data, error } = await supabase
        .from('consorcio_termo_modelos')
        .insert({
          nome,
          conteudo,
          versao: nextVersao,
          ativo: true,
          tipo,
          created_by: userData?.user?.id ?? null,
        } as any)
        .select('id, versao')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['consorcio-termo-modelos'] });
      toast.success(`Modelo salvo como versão ${data?.versao}`);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar modelo'),
  });
}

/** Termos de adesão emitidos, indexados por pending_registration_id (o mais recente primeiro). */
export function useTermosByPending() {
  return useQuery({
    queryKey: ['consorcio-termos-by-pending'],
    queryFn: async (): Promise<Record<string, ConsorcioTermo[]>> => {
      const { data, error } = await supabase
        .from('consorcio_termos')
        .select(TERMO_SELECT)
        .eq('tipo', 'adesao')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, ConsorcioTermo[]> = {};
      for (const t of (data || []) as any[]) {
        if (!t.pending_registration_id) continue;
        (map[t.pending_registration_id] ||= []).push(t as ConsorcioTermo);
      }
      return map;
    },
  });
}

/** Comprovantes de cadastro emitidos, indexados por card_id (o mais recente primeiro). */
export function useComprovantesByCard() {
  return useQuery({
    queryKey: ['consorcio-comprovantes-by-card'],
    queryFn: async (): Promise<Record<string, ConsorcioTermo[]>> => {
      const { data, error } = await supabase
        .from('consorcio_termos')
        .select(TERMO_SELECT)
        .eq('tipo', 'comprovante_cadastro')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, ConsorcioTermo[]> = {};
      for (const t of (data || []) as any[]) {
        if (!t.card_id) continue;
        (map[t.card_id] ||= []).push(t as ConsorcioTermo);
      }
      return map;
    },
  });
}

export function useCreateTermo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tipo?: TermoTipo;
      pendingRegistrationId?: string | null;
      cardId?: string | null;
      proposalId?: string | null;
      dealId?: string | null;
      modeloId: string;
      modeloVersao: number;
      dados: TermoDados;
      conteudoRenderizado: string;
      /** Validade do link. Termo de adesão: prazo curto de assinatura. Comprovante: 2 anos. */
      expiresAt?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const hash = await sha256Hex(input.conteudoRenderizado);
      const { data, error } = await supabase
        .from('consorcio_termos')
        .insert({
          tipo: input.tipo ?? 'adesao',
          pending_registration_id: input.pendingRegistrationId ?? null,
          card_id: input.cardId ?? null,
          proposal_id: input.proposalId ?? null,
          deal_id: input.dealId ?? null,
          modelo_id: input.modeloId,
          modelo_versao: input.modeloVersao,
          dados_snapshot: input.dados as any,
          conteudo_renderizado: input.conteudoRenderizado,
          conteudo_hash: hash,
          ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
          created_by: userData?.user?.id ?? null,
        } as any)
        .select(TERMO_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as ConsorcioTermo;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['consorcio-termos-by-pending'] });
      qc.invalidateQueries({ queryKey: ['consorcio-termos-by-proposal'] });
      qc.invalidateQueries({ queryKey: ['consorcio-termo-assinatura-metrics'] });
      qc.invalidateQueries({ queryKey: ['consorcio-comprovantes-by-card'] });
      toast.success(
        vars.tipo === 'comprovante_cadastro' ? 'Comprovante de cadastro gerado' : 'Termo de adesão gerado',
      );
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar documento'),
  });
}

export function useCancelTermo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ termoId, motivo }: { termoId: string; motivo: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('consorcio_termos')
        .update({
          status: 'cancelado',
          cancelado_em: new Date().toISOString(),
          cancelado_por: userData?.user?.id ?? null,
          cancelado_motivo: motivo,
        })
        .eq('id', termoId)
        .eq('status', 'pendente');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-termos-by-pending'] });
      qc.invalidateQueries({ queryKey: ['consorcio-termos-by-proposal'] });
      qc.invalidateQueries({ queryKey: ['consorcio-termo-assinatura-metrics'] });
      qc.invalidateQueries({ queryKey: ['consorcio-comprovantes-by-card'] });
      toast.success('Documento cancelado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao cancelar documento'),
  });
}

export function termoPublicUrl(token: string): string {
  return `${window.location.origin}/termo/${token}`;
}

// ── Etapa 3 do funil Consórcio (Termos de Adesão Pendentes) ──────────────

/** Termos de adesão indexados por `proposal_id` (mais recente primeiro). */
export function useTermosByProposal() {
  return useQuery({
    queryKey: ['consorcio-termos-by-proposal'],
    queryFn: async (): Promise<Record<string, ConsorcioTermo[]>> => {
      const { data, error } = await supabase
        .from('consorcio_termos')
        .select(TERMO_SELECT)
        .eq('tipo', 'adesao')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, ConsorcioTermo[]> = {};
      for (const t of (data || []) as any[]) {
        if (!t.proposal_id) continue;
        (map[t.proposal_id] ||= []).push(t as ConsorcioTermo);
      }
      return map;
    },
  });
}

/**
 * Cadastro pendente (não excluído) de cada proposta. O termo é montado a partir
 * do cadastro pendente — sem ele não há dado suficiente para gerar o documento.
 */
export function useRegistrationIdsByProposal(proposalIds: string[]) {
  const key = [...proposalIds].sort().join(',');
  return useQuery({
    queryKey: ['consorcio-registration-by-proposal', key],
    enabled: proposalIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const map: Record<string, string> = {};
      const chunk = 200;
      for (let i = 0; i < proposalIds.length; i += chunk) {
        const { data, error } = await supabase
          .from('consorcio_pending_registrations')
          .select('id, proposal_id, status, created_at')
          .in('proposal_id', proposalIds.slice(i, i + chunk))
          .order('created_at', { ascending: false });
        if (error) throw error;
        for (const r of (data || []) as any[]) {
          if (r.status === 'excluida' || !r.proposal_id) continue;
          if (!map[r.proposal_id]) map[r.proposal_id] = r.id as string;
        }
      }
      return map;
    },
  });
}

export interface TermoAssinaturaMetrics {
  gerados: number;
  assinados: number;
  taxa: number | null;
  medianaHoras: number | null;
}

/**
 * Taxa de assinatura do período: assinados ÷ gerados, com o tempo mediano entre
 * gerar e assinar. É o único número que diz algo sobre a etapa 3 — a conversão
 * 2→3 é 100% por construção, já que toda venda lançada gera termo pendente.
 */
export function useTermoAssinaturaMetrics(range: { startDate?: Date; endDate?: Date }) {
  const de = range.startDate ? range.startDate.toISOString().slice(0, 10) : null;
  const ate = range.endDate ? range.endDate.toISOString().slice(0, 10) : null;
  return useQuery({
    queryKey: ['consorcio-termo-assinatura-metrics', de, ate],
    staleTime: 60_000,
    queryFn: async (): Promise<TermoAssinaturaMetrics> => {
      let q = supabase
        .from('consorcio_termos')
        .select('created_at, assinado_em, status')
        .eq('tipo', 'adesao')
        .neq('status', 'cancelado');
      if (de) q = q.gte('created_at', `${de}T00:00:00`);
      if (ate) q = q.lte('created_at', `${ate}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];
      const assinadosRows = rows.filter(r => r.assinado_em);
      const horas = assinadosRows
        .map(r => (new Date(r.assinado_em).getTime() - new Date(r.created_at).getTime()) / 3_600_000)
        .filter(h => Number.isFinite(h) && h >= 0)
        .sort((a, b) => a - b);
      const mediana = horas.length
        ? horas.length % 2
          ? horas[(horas.length - 1) / 2]
          : (horas[horas.length / 2 - 1] + horas[horas.length / 2]) / 2
        : null;
      return {
        gerados: rows.length,
        assinados: assinadosRows.length,
        taxa: rows.length ? (assinadosRows.length / rows.length) * 100 : null,
        medianaHoras: mediana,
      };
    },
  });
}
