import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDealBriefing } from '@/hooks/useDealBriefing';
import { useLeadProfile } from '@/hooks/useLeadProfile';
import { useQualificationNote } from '@/hooks/useQualificationNote';
import { cn } from '@/lib/utils';
import { montarResumoAnamnese } from '@/lib/resumoAnamnese';

/** Resumo da anamnese para o SDR, enquanto o negócio não tem briefing de IA com conteúdo. */
export function ResumoAnamneseCard({ dealId, contactId }: { dealId: string; contactId?: string | null }) {
  const { data: briefing, isLoading: lb } = useDealBriefing(dealId);
  // Mesma query key do bloco "Perfil do Lead" (contactId, sem dealId).
  const { data: profile } = useLeadProfile(contactId);
  const { data: qual } = useQualificationNote(dealId);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  if (lb || briefing?.conteudo) return null;
  const answers = ((qual?.metadata as { answers?: Record<string, unknown> } | null)?.answers) ?? null;
  const r = montarResumoAnamnese(profile as Record<string, unknown> | null, answers);
  if (!r) return null;

  const verTodos = () => document.getElementById('perfil-do-lead')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="rounded-lg border border-lime-500/40 bg-card p-3 space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-lime-600 dark:text-lime-400">
        Resumo da anamnese{r.preenchidaEm && <span className="font-normal normal-case text-muted-foreground"> · preenchida em {r.preenchidaEm}</span>}
      </div>

      {r.texto && <p className="text-[13px] leading-relaxed">{r.texto}</p>}

      {r.alertas.length > 0 && (
        <ul className="space-y-1">
          {r.alertas.map((a, i) => (
            <li key={i} className={cn('flex gap-2 rounded px-2 py-1 text-xs', a.tom === 'vermelho' ? 'bg-destructive/10' : 'bg-amber-500/10')}>
              <span className={cn('font-bold', a.tom === 'vermelho' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>!</span>
              <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      )}

      {r.linhas.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setDetalhesAbertos((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', !detalhesAbertos && '-rotate-90')} />
            {detalhesAbertos ? 'Ocultar detalhes' : 'Ver detalhes'}
          </button>

          {detalhesAbertos && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {r.linhas.map((l) => (
                <div key={l.rotulo} className="contents">
                  <dt className="text-muted-foreground">{l.rotulo}</dt>
                  <dd>
                    {l.valor}
                    {l.qualificacao && <span className="ml-2 text-muted-foreground">Na qualificação: {l.qualificacao}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <button type="button" onClick={verTodos} className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
        Ver todos os campos
      </button>
    </div>
  );
}
