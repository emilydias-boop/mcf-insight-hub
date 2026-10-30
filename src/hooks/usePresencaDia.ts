import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PessoaPresenca, PresencaBU } from '@/lib/presencaDia';

// Tabelas/funções novas ainda podem não estar nos tipos gerados.
const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
};

const uid = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

export type PresencaConfig = { bu: PresencaBU; reunioes_por_closer: number; leads_por_reuniao: number; horario_aviso: string; horario_corte: string };

/** BUs em que o usuário é líder (ou todas, para admin). A RLS só devolve as linhas permitidas. */
export function usePresencaConfig(enabled = true) {
  return useQuery({
    queryKey: ['presenca-config'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PresencaConfig[]> => {
      const { data, error } = await db.from('presenca_config_bu').select('bu, reunioes_por_closer, leads_por_reuniao, horario_aviso, horario_corte').order('bu');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function usePresencaLista(data: string, bu: PresencaBU | null) {
  return useQuery({
    queryKey: ['presenca-lista', data, bu],
    enabled: !!bu,
    queryFn: async (): Promise<PessoaPresenca[]> => {
      const { data: r, error } = await db.rpc('presenca_lista_dia', { p_data: data, p_bu: bu });
      if (error) throw new Error(error.message);
      return (r ?? []) as PessoaPresenca[];
    },
  });
}

export function useCapacidadeDia(data: string, bu: PresencaBU | null) {
  return useQuery({
    queryKey: ['presenca-capacidade', data, bu],
    enabled: !!bu,
    queryFn: async () => {
      const { data: r, error } = await db.rpc('capacidade_dia', { p_data: data, p_bu: bu });
      if (error) throw new Error(error.message);
      return r as Record<string, any>;
    },
  });
}

export function useConfirmacoesDia(data: string, enabled = true) {
  return useQuery({
    queryKey: ['presenca-confirmacoes', data],
    enabled,
    queryFn: async (): Promise<{ bu: PresencaBU; confirmado_em: string }[]> => {
      const { data: r, error } = await db.from('presenca_confirmacoes').select('bu, confirmado_em').eq('data', data);
      if (error) throw new Error(error.message);
      return r ?? [];
    },
  });
}

export function usePresencaMutations(data: string, bu: PresencaBU | null) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['presenca-lista', data, bu] });
    qc.invalidateQueries({ queryKey: ['presenca-capacidade', data, bu] });
    qc.invalidateQueries({ queryKey: ['presenca-confirmacoes', data] });
  };
  const corrigir = useMutation({
    mutationFn: async (v: { tipo: 'closer' | 'sdr'; profile_id: string; presente: boolean; motivo: string }) => {
      const { error } = await db.from('presenca_correcoes').upsert(
        { data, bu, ...v, motivo: v.motivo.trim(), corrigido_por: await uid(), corrigido_em: new Date().toISOString() },
        { onConflict: 'data,bu,tipo,profile_id' },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
  const confirmar = useMutation({
    mutationFn: async () => {
      const { error } = await db.from('presenca_confirmacoes').upsert({ data, bu, confirmado_por: await uid(), confirmado_em: new Date().toISOString() }, { onConflict: 'data,bu' });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
  return { corrigir, confirmar };
}
