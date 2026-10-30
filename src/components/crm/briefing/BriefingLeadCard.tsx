import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ListTree } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDealBriefing } from '@/hooks/useDealBriefing';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  rotuloFonte, estiloAtencao, fontesUsadas, geradoHa,
  type BriefingConteudo, type BriefingItem,
} from '@/lib/briefingLead';

function Chips({ fontes }: { fontes?: string[] }) {
  if (!fontes?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 ml-1 align-middle">
      {fontes.map((f) => (
        <span key={f} className="rounded border border-border bg-muted px-1 py-px text-[9px] leading-none text-muted-foreground">
          {rotuloFonte(f)}
        </span>
      ))}
    </span>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</div>
      {children}
    </div>
  );
}

function Lista({ itens }: { itens: BriefingItem[] }) {
  return (
    <ul className="space-y-1 text-xs">
      {itens.map((it, i) => (
        <li key={i} className="leading-snug">{it.texto}<Chips fontes={it.fontes} /></li>
      ))}
    </ul>
  );
}

export function BriefingLeadCard({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const { data: b, isLoading } = useDealBriefing(dealId);
  const [verFontes, setVerFontes] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  if (isLoading || !b) return null;

  const c = (b.conteudo ?? null) as unknown as BriefingConteudo | null;
  const temConteudo = !!c;
  const fontes = fontesUsadas(c);

  const atualizar = async () => {
    setAtualizando(true);
    try {
      const { error } = await supabase.rpc('solicitar_briefing', { p_deal_id: dealId });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['deal-briefing', dealId] });
      const { error: fErr } = await supabase.functions.invoke('briefing-lead-gerar', { body: { deal_id: dealId } });
      if (fErr) throw fErr;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar o briefing');
    } finally {
      qc.invalidateQueries({ queryKey: ['deal-briefing', dealId] });
      setAtualizando(false);
    }
  };

  const ocupado = b.status === 'pendente' || b.status === 'gerando';

  return (
    <div className="rounded-lg border border-lime-500/40 bg-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-lime-600 dark:text-lime-400">
            Briefing para a {b.momento ?? 'R1'}
          </div>
          {temConteudo && (
            <div className="text-[10px] text-muted-foreground">
              gerado há {geradoHa(b.gerado_em)} · {fontes.length} {fontes.length === 1 ? 'fonte' : 'fontes'}
              {ocupado && <span className="ml-1 italic">· atualizando…</span>}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {temConteudo && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setVerFontes((v) => !v)}>
              <ListTree className="h-3 w-3 mr-1" />Ver fontes
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={atualizar} disabled={atualizando}>
            <RefreshCw className={cn('h-3 w-3 mr-1', atualizando && 'animate-spin')} />Atualizar
          </Button>
        </div>
      </div>

      {verFontes && temConteudo && (
        <div className="rounded border border-border bg-muted/40 p-2 text-[11px]">
          <span className="text-muted-foreground">Fontes usadas:</span>
          <Chips fontes={fontes} />
        </div>
      )}

      {!temConteudo && ocupado && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Preparando o briefing…</div>
          <Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" />
        </div>
      )}
      {!temConteudo && b.status === 'erro' && (
        <div className="text-xs text-muted-foreground">Não foi possível gerar o briefing agora.</div>
      )}
      {!temConteudo && b.status === 'sem_fontes' && (
        <div className="text-xs text-muted-foreground">Ainda não há informação suficiente sobre este lead.</div>
      )}

      {c && (
        <>
          {c.quem_e?.length > 0 && (
            <Secao titulo="Quem é">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {c.quem_e.map((q, i) => (
                  <div key={i} className="contents">
                    <dt className="text-muted-foreground">{q.rotulo}</dt>
                    <dd>{q.texto}<Chips fontes={q.fontes} /></dd>
                  </div>
                ))}
              </dl>
            </Secao>
          )}
          {c.como_chegou?.length > 0 && <Secao titulo="Como chegou"><Lista itens={c.como_chegou} /></Secao>}
          {c.ja_falado?.length > 0 && <Secao titulo="O que já foi falado"><Lista itens={c.ja_falado} /></Secao>}
          {c.combinado?.length > 0 && <Secao titulo="Ficou combinado"><Lista itens={c.combinado} /></Secao>}
          {c.atencao?.length > 0 && (
            <Secao titulo="Atenção">
              <ul className="space-y-1">
                {c.atencao.map((a, i) => {
                  const s = estiloAtencao(a.tipo);
                  return (
                    <li key={i} className={cn('flex gap-2 rounded px-2 py-1 text-xs',
                      s.tom === 'vermelho' ? 'bg-destructive/10' : 'bg-amber-500/10')}>
                      <span className={cn('font-bold', s.tom === 'vermelho' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>{s.icone}</span>
                      <span>{a.texto}<Chips fontes={a.fontes} /></span>
                    </li>
                  );
                })}
              </ul>
            </Secao>
          )}
          {c.perguntas?.length > 0 && (
            <Secao titulo="Para a reunião">
              <ol className="list-decimal pl-4 space-y-0.5 text-xs">
                {c.perguntas.map((p, i) => <li key={i}>{p}</li>)}
              </ol>
            </Secao>
          )}
        </>
      )}
    </div>
  );
}
