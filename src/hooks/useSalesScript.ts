import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MeetingType = 'r1' | 'r2';
export type IcpSegment = 'A' | 'B' | 'C' | null;

export interface SalesScriptStep {
  id: string;
  versao: number;
  meeting_type: string;
  icp_segment: string | null;
  ordem: number;
  etapa: string;
  descricao: string | null;
  criterio: string;
  peso: number;
  obrigatoria: boolean;
}

export interface ResolvedScriptStep {
  ordem: number;
  etapa: string;
  descricao: string | null;
  criterio: string;
  peso: number;
  obrigatoria: boolean;
  versao: number;
  icp_segment: string | null;
}

export interface ScriptStepInput {
  ordem: number;
  etapa: string;
  descricao: string | null;
  criterio: string;
  peso: number;
  obrigatoria: boolean;
}

export function useSalesScript(meetingType: MeetingType, icpSegment: IcpSegment = null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sales-script-steps', meetingType, icpSegment ?? 'default'],
    queryFn: async (): Promise<SalesScriptStep[]> => {
      let q = supabase
        .from('sales_script_steps')
        .select('id, versao, meeting_type, icp_segment, ordem, etapa, descricao, criterio, peso, obrigatoria')
        .eq('meeting_type', meetingType)
        .eq('is_active', true);

      q = icpSegment ? q.eq('icp_segment', icpSegment) : q.is('icp_segment', null);

      const { data, error } = await q.order('ordem', { ascending: true });

      if (error) throw error;
      return (data || []) as SalesScriptStep[];
    },
    staleTime: 60 * 1000,
  });

  const resolvido = useQuery({
    queryKey: ['sales-script-resolver', meetingType, icpSegment ?? 'default'],
    queryFn: async (): Promise<ResolvedScriptStep[]> => {
      const { data, error } = await supabase.rpc('script_resolver', {
        _meeting_type: meetingType,
        _icp_segment: icpSegment,
      });
      if (error) throw error;
      return (data || []) as ResolvedScriptStep[];
    },
    staleTime: 60 * 1000,
  });

  const publicar = useMutation({
    mutationFn: async (etapas: ScriptStepInput[]) => {
      const { data, error } = await supabase.rpc('script_publicar_versao', {
        _meeting_type: meetingType,
        _etapas: etapas as unknown as never,
        _icp_segment: icpSegment,
      });
      if (error) throw error;
      return data as { versao?: number; etapas?: number } | null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-script-steps'] });
      queryClient.invalidateQueries({ queryKey: ['sales-script-resolver'] });
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

  return { ...query, resolvido, publicar, reavaliar };
}
