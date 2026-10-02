import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Sparkles, MessageCircle, Phone, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { QUALIFICATION_QUESTIONS } from './QualificationQuestions';
import { creditoVisibleQuestions, previewCreditoIcp } from './CreditoQualificationQuestions';
import { LeadSegmentBadge } from '@/components/crm/LeadSegmentBadge';

function WhatsappPrintThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.storage
      .from('qualification-attachments')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block mt-2">
      <img
        src={url}
        alt="Print do WhatsApp"
        className="max-h-48 rounded border border-border"
      />
    </a>
  );
}

interface Props {
  dealId: string | null | undefined;
}

/**
 * Mostra ao Closer (na R1) o histórico do que foi qualificado pelo SDR:
 * - Resumo IA da ligação (ai_call_summary), ou
 * - Respostas estruturadas do questionário + print do WhatsApp
 */
export function QualificationHistorySection({ dealId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['qualification-history', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      // Look across sibling deals of the same contact so a qualification
      // registered in an Incorporador deal shows up on the Consórcio deal too.
      let dealIds: string[] = [dealId];
      const { data: currentDeal } = await supabase
        .from('crm_deals')
        .select('contact_id')
        .eq('id', dealId)
        .maybeSingle();
      if (currentDeal?.contact_id) {
        const { data: related } = await supabase
          .from('crm_deals')
          .select('id')
          .eq('contact_id', currentDeal.contact_id);
        if (related && related.length > 0) {
          dealIds = Array.from(new Set(related.map((r: any) => r.id)));
        }
      }
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*')
        .in('deal_id', dealIds)
        .in('activity_type', ['qualification_note', 'ai_call_summary'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!dealId,
  });

  const precisaDadosPessoais = (data || []).some((act: any) => {
    const a = ((act.metadata || {}) as any).answers || {};
    return typeof a.modalidade === 'string' && a.modalidade.trim().length > 0 && a.dados_pessoais_restritos === 'sim';
  });
  const { data: dadosPessoais } = useQuery({
    queryKey: ['credito-dados-pessoais', dealId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('credito_dados_pessoais')
        .select('doc_cpf, doc_rg, data_nascimento, estado_civil')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as
        | { doc_cpf: string | null; doc_rg: string | null; data_nascimento: string | null; estado_civil: string | null }
        | null;
    },
    enabled: !!dealId && precisaDadosPessoais,
  });

  if (!dealId || isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <div className="pt-2 border-t border-blue-500/20">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList className="h-4 w-4 text-purple-600" />
        <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
          Qualificação registrada pelo SDR ({data.length})
        </span>
      </div>
      <ScrollArea className="max-h-[320px]">
        <div className="space-y-3 pr-2">
          {data.map((act: any) => {
            const isAI = act.activity_type === 'ai_call_summary';
            const meta = (act.metadata || {}) as any;
            const channel = meta.channel as 'whatsapp' | 'call' | undefined;
            const answers = (meta.answers || {}) as Record<string, string>;
            const printPath = meta.whatsapp_print_url as string | undefined;
            const sdrName = meta.sdr_name as string | undefined;
            // A chave 'modalidade' só existe no questionário da BU Crédito
            // (CREDITO_QUALIFICATION_QUESTIONS) — é o marcador de que estas
            // respostas não são do formulário de incorporador.
            const isCreditoAnswers =
              typeof answers.modalidade === 'string' && answers.modalidade.trim().length > 0;
            const creditoIcp = isCreditoAnswers ? previewCreditoIcp(answers) : null;

            return (
              <div
                key={act.id}
                className={`rounded-md border p-3 ${
                  isAI
                    ? 'bg-fuchsia-500/5 border-fuchsia-500/30'
                    : 'bg-purple-500/5 border-purple-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {isAI ? (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-fuchsia-600" />
                        <span className="text-fuchsia-700 dark:text-fuchsia-400">
                          Resumo IA da Ligação
                        </span>
                      </>
                    ) : channel === 'whatsapp' ? (
                      <>
                        <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-purple-700 dark:text-purple-400">
                          Qualificação via WhatsApp
                        </span>
                      </>
                    ) : (
                      <>
                        <Phone className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-purple-700 dark:text-purple-400">
                          Qualificação via Ligação
                        </span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(act.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                {(sdrName || creditoIcp) && (
                  <div className="flex items-center gap-2 mb-2">
                    {sdrName && (
                      <Badge variant="outline" className="text-[10px]">
                        Por: {sdrName}
                      </Badge>
                    )}
                    {creditoIcp && <LeadSegmentBadge segment={creditoIcp} size="sm" />}
                  </div>
                )}

                {/* Questionário estruturado (WhatsApp) */}
                {!isAI && Object.keys(answers).length > 0 && (
                  <div className="space-y-2">
                    {(() => {
                      const questions: { key: string; label: string }[] = isCreditoAnswers
                        ? creditoVisibleQuestions(answers)
                        : QUALIFICATION_QUESTIONS;
                      return questions.map((q) => {
                        const a = (answers[q.key] || '').trim();
                        if (!a || q.key === 'dados_pessoais_restritos') return null;
                        return (
                          <div key={q.key} className="text-xs">
                            <p className="font-medium text-foreground/80">▸ {q.label}</p>
                            <p className="text-muted-foreground whitespace-pre-wrap pl-3">{a}</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {isCreditoAnswers && answers.dados_pessoais_restritos === 'sim' && (
                  dadosPessoais ? (
                    <div className="mt-2 rounded border border-border p-2 text-xs space-y-0.5">
                      <p className="flex items-center gap-1 font-medium text-foreground/80">
                        <Lock className="h-3 w-3" /> Dados pessoais (restrito ao time do Crédito)
                      </p>
                      <p className="text-muted-foreground">CPF: {dadosPessoais.doc_cpf || '—'}</p>
                      <p className="text-muted-foreground">RG: {dadosPessoais.doc_rg || '—'}</p>
                      <p className="text-muted-foreground">Data de nascimento: {dadosPessoais.data_nascimento || '—'}</p>
                      <p className="text-muted-foreground">Estado civil: {dadosPessoais.estado_civil || '—'}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Dados pessoais restritos ao time do Crédito.
                    </p>
                  )
                )}

                {/* Transcrição/descrição (Resumo IA ou fallback) */}
                {(isAI || Object.keys(answers).length === 0) && act.description && (
                  <p className="text-xs whitespace-pre-wrap text-foreground/90">
                    {act.description}
                  </p>
                )}

                {printPath && <WhatsappPrintThumb path={printPath} />}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}