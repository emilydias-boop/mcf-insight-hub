import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBUContext } from '@/contexts/BUContext';

export type QualificationSource = 'ai_call_summary' | 'whatsapp' | 'call' | null;

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
  const { activeBU } = useBUContext();
  const bypassForBU = activeBU === 'consorcio';
  return useQuery<QualificationStatus>({
    queryKey: ['qualification-status', dealId, bypassForBU ? 'bypass' : 'check'],
    enabled: !!dealId,
    queryFn: async () => {
      if (!dealId) {
        return { isQualified: false, source: null, reason: 'sem deal' };
      }

      // BU - Consórcio: qualificação obrigatória não se aplica.
      // Apenas BU - Incorporador MCF exige qualificação (ligação com resumo IA
      // ou questionário WhatsApp) antes de agendar a R1.
      if (bypassForBU) {
        return {
          isQualified: true,
          source: null,
          reason: 'BU - Consórcio: qualificação não exigida',
        };
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

      const manualNote = data?.find((a) => {
        if (a.activity_type !== 'qualification_note') return false;
        const md = (a.metadata || {}) as Record<string, any>;
        if (md.channel !== 'whatsapp' && md.channel !== 'call') return false;
        const answers = md.answers || {};
        const keys = ['tempo_mcf', 'profissao', 'socio', 'renda', 'constroi_venda', 'terreno_imovel'];
        return keys.every((k) => ((answers[k] || '') as string).trim().length >= 15);
      });

      if (manualNote) {
        const md = (manualNote.metadata || {}) as Record<string, any>;
        const ch: 'call' | 'whatsapp' = md.channel === 'call' ? 'call' : 'whatsapp';
        return {
          isQualified: true,
          source: ch,
          reason:
            ch === 'call'
              ? 'Qualificação via ligação externa registrada'
              : 'Qualificação via WhatsApp registrada',
        };
      }

      return {
        isQualified: false,
        source: null,
        reason:
          'Ligue pelo sistema (IA), registre uma ligação externa ou responda o questionário via WhatsApp',
      };
    },
    staleTime: 30_000,
  });
}