import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type QualificationSource = 'ai_call_summary' | 'whatsapp' | null;

export interface QualificationStatus {
  isQualified: boolean;
  source: QualificationSource;
  reason: string;
}

/**
 * Considera o lead qualificado se houver:
 * - uma atividade `ai_call_summary` (resumo da IA da ligação), OU
 * - uma `qualification_note` válida (canal whatsapp com print + respostas).
 */
export function useQualificationStatus(dealId?: string) {
  return useQuery<QualificationStatus>({
    queryKey: ['qualification-status', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      if (!dealId) {
        return { isQualified: false, source: null, reason: 'sem deal' };
      }

      const { data, error } = await supabase
        .from('deal_activities')
        .select('id, activity_type, metadata, created_at')
        .eq('deal_id', dealId)
        .in('activity_type', ['ai_call_summary', 'qualification_note'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const aiSummary = data?.find((a) => a.activity_type === 'ai_call_summary');
      if (aiSummary) {
        return {
          isQualified: true,
          source: 'ai_call_summary',
          reason: 'Resumo IA da ligação registrado',
        };
      }

      const wppNote = data?.find((a) => {
        if (a.activity_type !== 'qualification_note') return false;
        const md = (a.metadata || {}) as Record<string, any>;
        if (md.channel !== 'whatsapp') return false;
        const answers = md.answers || {};
        const keys = ['tempo_mcf', 'profissao', 'socio', 'renda', 'constroi_venda', 'terreno_imovel'];
        return keys.every((k) => ((answers[k] || '') as string).trim().length >= 15);
      });

      if (wppNote) {
        return {
          isQualified: true,
          source: 'whatsapp',
          reason: 'Qualificação via WhatsApp registrada',
        };
      }

      return {
        isQualified: false,
        source: null,
        reason: 'Faça uma ligação (resumo IA) ou registre a qualificação via WhatsApp',
      };
    },
    staleTime: 30_000,
  });
}