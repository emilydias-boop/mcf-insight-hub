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
  created_at: string;
  created_by: string | null;
}

export interface ConsorcioTermo {
  id: string;
  pending_registration_id: string | null;
  proposal_id: string | null;
  deal_id: string | null;
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
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  created_at: string;
}

const TERMO_SELECT =
  'id, pending_registration_id, proposal_id, deal_id, modelo_id, modelo_versao, access_token, conteudo_renderizado, conteudo_hash, status, expires_at, assinado_em, assinante_nome, assinante_cpf, assinante_ip, cancelado_em, cancelado_motivo, created_at';

/** Modelos do termo. `onlyAtivo` para o uso operacional (geração). */
export function useTermoModelos(onlyAtivo = false) {
  return useQuery({
    queryKey: ['consorcio-termo-modelos', onlyAtivo],
    queryFn: async (): Promise<ConsorcioTermoModelo[]> => {
      let q = supabase
        .from('consorcio_termo_modelos')
        .select('id, nome, conteudo, versao, ativo, created_at, created_by')
        .order('versao', { ascending: false });
      if (onlyAtivo) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ConsorcioTermoModelo[];
    },
  });
}

/** Salva uma NOVA versão do modelo (nunca sobrescreve o texto anterior). */
export function useSaveTermoModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, conteudo }: { nome: string; conteudo: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: last } = await supabase
        .from('consorcio_termo_modelos')
        .select('versao')
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextVersao = Number((last as any)?.versao || 0) + 1;

      // desativa versões anteriores — só a mais nova fica ativa
      await supabase.from('consorcio_termo_modelos').update({ ativo: false }).eq('ativo', true);

      const { data, error } = await supabase
        .from('consorcio_termo_modelos')
        .insert({
          nome,
          conteudo,
          versao: nextVersao,
          ativo: true,
          created_by: userData?.user?.id ?? null,
        })
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

/** Termos emitidos, indexados por pending_registration_id (o mais recente primeiro). */
export function useTermosByPending() {
  return useQuery({
    queryKey: ['consorcio-termos-by-pending'],
    queryFn: async (): Promise<Record<string, ConsorcioTermo[]>> => {
      const { data, error } = await supabase
        .from('consorcio_termos')
        .select(TERMO_SELECT)
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

export function useCreateTermo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pendingRegistrationId: string;
      proposalId?: string | null;
      dealId?: string | null;
      modeloId: string;
      modeloVersao: number;
      dados: TermoDados;
      conteudoRenderizado: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const hash = await sha256Hex(input.conteudoRenderizado);
      const { data, error } = await supabase
        .from('consorcio_termos')
        .insert({
          pending_registration_id: input.pendingRegistrationId,
          proposal_id: input.proposalId ?? null,
          deal_id: input.dealId ?? null,
          modelo_id: input.modeloId,
          modelo_versao: input.modeloVersao,
          dados_snapshot: input.dados as any,
          conteudo_renderizado: input.conteudoRenderizado,
          conteudo_hash: hash,
          created_by: userData?.user?.id ?? null,
        })
        .select(TERMO_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as ConsorcioTermo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-termos-by-pending'] });
      toast.success('Termo de adesão gerado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar termo'),
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
      toast.success('Termo cancelado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao cancelar termo'),
  });
}

export function termoPublicUrl(token: string): string {
  return `${window.location.origin}/termo/${token}`;
}
