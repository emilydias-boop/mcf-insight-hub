import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MeetingType = 'r1' | 'r2';

export interface SalesScriptStep {
  id: string;
  versao: number;
  meeting_type: string;
  ordem: number;
  etapa: string;
  descricao: string | null;
  criterio: string;
  peso: number;
  obrigatoria: boolean;
}

export interface ScriptStepInput {
  ordem: number;
  etapa: string;
  descricao: string | null;
  criterio: string;
  peso: number;
  obrigatoria: boolean;
}

export function useSalesScript(meetingType: MeetingType) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sales-script-steps', meetingType],
    queryFn: async (): Promise<SalesScriptStep[]> => {
      const { data, error } = await supabase
        .from('sales_script_steps')
        .select('id, versao, meeting_type, ordem, etapa, descricao, criterio, peso, obrigatoria')
        .eq('meeting_type', meetingType)
        .eq('is_active', true)
        .order('ordem', { ascending: true });

      if (error) throw error;
      return (data || []) as SalesScriptStep[];
    },
    staleTime: 60 * 1000,
  });

  const publicar = useMutation({
    mutationFn: async (etapas: ScriptStepInput[]) => {
      const { data, error } = await supabase.rpc('script_publicar_versao', {
        _meeting_type: meetingType,
        _etapas: etapas as unknown as never,
      });
      if (error) throw error;
      return data as { versao?: number; etapas?: number } | null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-script-steps'] });
    },
  });

  const reavaliar = useMutation({
    mutationFn: async (tipo: MeetingType | null) => {
      const { data, error } = await supabase.rpc(
        'script_reavaliar',
        tipo ? { _meeting_type: tipo } : {},
      );
      if (error) throw error;
      return data as { reenfileiradas?: number } | null;
    },
  });

  return { ...query, publicar, reavaliar };
}
