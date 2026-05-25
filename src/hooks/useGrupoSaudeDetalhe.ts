import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useGrupoSaude(grupo: string | null) {
  return useQuery({
    queryKey: ['grupo-saude-detalhe', grupo],
    enabled: !!grupo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_grupo_saude' as any)
        .select('*')
        .eq('grupo', grupo!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useCalendarioGrupo(grupo: string | null) {
  return useQuery({
    queryKey: ['grupo-calendario', grupo],
    enabled: !!grupo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_calendario_assembleia' as any)
        .select('*')
        .eq('grupo', grupo!)
        .order('numero', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useResultadosGrupo(grupo: string | null) {
  return useQuery({
    queryKey: ['grupo-resultados', grupo],
    enabled: !!grupo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consorcio_assembleia_resultados' as any)
        .select('*')
        .eq('grupo', grupo!)
        .order('data_assembleia', { ascending: false })
        .order('cota', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useUpsertGrupoSaude() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('consorcio_grupo_saude' as any).upsert(payload, { onConflict: 'grupo' });
      if (error) throw error;
    },
    onSuccess: (_d, vars: any) => {
      qc.invalidateQueries({ queryKey: ['grupo-saude-detalhe', vars.grupo] });
      toast.success('Saúde do grupo atualizada');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpsertCalendario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: any[]) => {
      if (rows.length === 0) return;
      const { error } = await supabase
        .from('consorcio_calendario_assembleia' as any)
        .upsert(rows, { onConflict: 'grupo,numero' });
      if (error) throw error;
    },
    onSuccess: (_d, rows: any[]) => {
      qc.invalidateQueries({ queryKey: ['grupo-calendario', rows[0]?.grupo] });
      toast.success('Calendário importado');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useInsertResultados() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: any[]) => {
      if (rows.length === 0) return;
      const { error } = await supabase.from('consorcio_assembleia_resultados' as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: (_d, rows: any[]) => {
      qc.invalidateQueries({ queryKey: ['grupo-resultados', rows[0]?.grupo] });
      toast.success('Resultados registrados');
    },
    onError: (e: any) => toast.error(e.message),
  });
}