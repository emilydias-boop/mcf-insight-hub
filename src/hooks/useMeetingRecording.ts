import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TranscriptLine {
  speaker?: string | null;
  transcript?: string | null;
  timestamp?: string | number | null;
}

export interface MeetingRecording {
  id: string;
  meeting_slot_id: string | null;
  closer_id: string | null;
  title: string | null;
  host_email: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  summary: any;
  highlights: any;
  transcript: any;
  transcript_chars: number | null;
  ingest_status: string | null;
  analysis_status: string | null;
  match_method: string | null;
  meetgeek_meeting_id: string | null;
}

export interface MeetingAiReviewEtapa {
  ordem?: number;
  etapa?: string;
  cumpriu?: 'sim' | 'nao' | 'nao_aplicavel' | string;
  nota?: number;
  evidencia?: string;
  comentario?: string;
}

export interface MeetingAiReview {
  id: string;
  recording_id: string | null;
  meeting_slot_id: string | null;
  closer_id: string | null;
  nota_geral: number | null;
  aderencia_pct: number | null;
  meeting_type: string | null;
  script_versao: number | null;
  modelo: string | null;
  resumo: string | null;
  pontos_fortes: any;
  pontos_melhoria: any;
  etapas: any;
}

/**
 * Busca a gravação MeetGeek e a avaliação de aderência ao script de um slot da agenda.
 * RLS controla a visibilidade (admin/manager tudo, closer apenas as próprias).
 */
export function useMeetingRecording(meetingSlotId: string | null | undefined) {
  return useQuery({
    queryKey: ['meeting-recording', meetingSlotId],
    enabled: !!meetingSlotId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: recData, error: recError } = await supabase
        .from('meeting_recordings')
        .select(
          'id, meeting_slot_id, closer_id, title, host_email, started_at, ended_at, duration_minutes, summary, highlights, transcript, transcript_chars, ingest_status, analysis_status, match_method, meetgeek_meeting_id',
        )
        .eq('meeting_slot_id', meetingSlotId as string)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recError) throw recError;

      const recording = (recData as unknown as MeetingRecording) || null;

      let query = supabase
        .from('meeting_ai_reviews')
        .select(
          'id, recording_id, meeting_slot_id, closer_id, nota_geral, aderencia_pct, meeting_type, script_versao, modelo, resumo, pontos_fortes, pontos_melhoria, etapas',
        );

      query = recording?.id
        ? query.eq('recording_id', recording.id)
        : query.eq('meeting_slot_id', meetingSlotId as string);

      const { data: revData, error: revError } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (revError) throw revError;

      return {
        recording,
        review: (revData as unknown as MeetingAiReview) || null,
      };
    },
  });
}
