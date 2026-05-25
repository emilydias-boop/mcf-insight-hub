import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CategoriaBem = 'imovel' | 'auto' | 'moto' | 'servicos';

export interface FaixaRecomendacao {
  id: string;
  tipo_produto: CategoriaBem | string;
  distancia_min: number;
  distancia_max: number | null;
  percentual_lance: number | null;
  ordem: number;
}

export interface AssembleiaHistorico {
  id: string;
  grupo: string;
  data_assembleia: string;
  numero_loteria_aplicado: string | null;
  qtd_contemplados: number;
  observacao: string | null;
  created_at: string;
}

export interface AssembleiaContemplado {
  id: string;
  assembleia_id: string;
  cota: string;
  motivo: 'sorteio' | 'lance_livre' | 'lance_fixo';
  percentual_lance: number | null;
}

export interface GrupoConfig {
  grupo: string;
  vagas_padrao: number;
  observacao: string | null;
}

// --- Faixas ---
export function useFaixasRecomendacao() {
  return useQuery({
    queryKey: ['consorcio-faixas-recomendacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_faixas_recomendacao' as any)
        .select('*')
        .order('tipo_produto', { ascending: true })
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FaixaRecomendacao[];
    },
  });
}

export function useUpsertFaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (faixa: Partial<FaixaRecomendacao> & { tipo_produto: string }) => {
      const payload: any = { ...faixa };
      if (payload.id) {
        const { error } = await supabase.from('consorcio_faixas_recomendacao' as any).update(payload).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('consorcio_faixas_recomendacao' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-faixas-recomendacao'] });
      toast.success('Faixa salva');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteFaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consorcio_faixas_recomendacao' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-faixas-recomendacao'] });
      toast.success('Faixa removida');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// --- Histórico de assembleias ---
export function useHistoricoAssembleiasGrupo(grupo: string | null) {
  return useQuery({
    queryKey: ['consorcio-assembleias', grupo],
    enabled: !!grupo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_assembleias_historico' as any)
        .select('*')
        .eq('grupo', grupo!)
        .order('data_assembleia', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AssembleiaHistorico[];
    },
  });
}

export function useContempladosAssembleia(assembleiaId: string | null) {
  return useQuery({
    queryKey: ['consorcio-assembleia-contemplados', assembleiaId],
    enabled: !!assembleiaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_assembleia_contemplados' as any)
        .select('*')
        .eq('assembleia_id', assembleiaId!);
      if (error) throw error;
      return (data || []) as unknown as AssembleiaContemplado[];
    },
  });
}

export function useRegistrarAssembleia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      grupo: string;
      data_assembleia: string;
      numero_loteria_aplicado?: string;
      observacao?: string;
      contemplados: Array<{ cota: string; motivo: 'sorteio' | 'lance_livre' | 'lance_fixo'; percentual_lance?: number | null }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: assembleia, error: err1 } = await supabase
        .from('consorcio_assembleias_historico' as any)
        .insert({
          grupo: params.grupo,
          data_assembleia: params.data_assembleia,
          numero_loteria_aplicado: params.numero_loteria_aplicado || null,
          qtd_contemplados: params.contemplados.length,
          observacao: params.observacao || null,
          created_by: user?.id,
        } as any)
        .select('id')
        .single();
      if (err1) throw err1;

      if (params.contemplados.length > 0) {
        const rows = params.contemplados.map((c) => ({
          assembleia_id: (assembleia as any).id,
          cota: c.cota,
          motivo: c.motivo,
          percentual_lance: c.percentual_lance ?? null,
        }));
        const { error: err2 } = await supabase.from('consorcio_assembleia_contemplados' as any).insert(rows);
        if (err2) throw err2;
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['consorcio-assembleias', vars.grupo] });
      toast.success('Assembleia registrada');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteAssembleia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consorcio_assembleias_historico' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consorcio-assembleias'] });
      toast.success('Assembleia removida');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// --- Grupo config ---
export function useGrupoConfig(grupo: string | null) {
  return useQuery({
    queryKey: ['consorcio-grupo-config', grupo],
    enabled: !!grupo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_grupos_config' as any)
        .select('*')
        .eq('grupo', grupo!)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as unknown as GrupoConfig | null;
    },
  });
}

export function useUpsertGrupoConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: GrupoConfig) => {
      const { error } = await supabase
        .from('consorcio_grupos_config' as any)
        .upsert(cfg as any, { onConflict: 'grupo' });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['consorcio-grupo-config', vars.grupo] });
      toast.success('Configuração do grupo salva');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

/**
 * Média de contemplados das últimas N assembleias (default 5).
 * Retorna arredondamento para cima quando >= 0.5.
 */
export function calcularVagasEstimadas(historico: AssembleiaHistorico[], fallback: number, limite = 5): { vagas: number; media: number; baseAssembleias: number } {
  if (!historico.length) return { vagas: fallback, media: 0, baseAssembleias: 0 };
  const ultimas = historico.slice(0, limite);
  const soma = ultimas.reduce((acc, h) => acc + (h.qtd_contemplados || 0), 0);
  const media = soma / ultimas.length;
  return { vagas: Math.max(1, Math.round(media)), media, baseAssembleias: ultimas.length };
}