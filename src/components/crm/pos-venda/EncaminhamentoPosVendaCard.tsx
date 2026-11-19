import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Contexto do encaminhamento Pós-venda → outra BU (somente leitura): nota do gerente,
// resumo e trechos da reunião de viabilidade. Só aparece quando o cartão veio de encaminhamento.
type Contexto = {
  encaminhado_em: string; gerente: string | null; nota_encaminhamento: string | null;
  reuniao_inicio: string | null; tem_gravacao: boolean; resumo: string | null;
  trechos: string[]; transcricao: { speaker?: string; timestamp?: string; transcript?: string }[];
};

const KW = /(carta de cr[eé]dito|cons[oó]rcio|renda passiva|loca[cç][aã]o|aluguel|alavanc\w*|cr[eé]dito imobili[aá]rio)/gi;
function destacar(t: string) {
  return t.split(KW).map((p, i) => (i % 2 ? <mark key={i} className="bg-primary/25 text-foreground rounded px-0.5">{p}</mark> : p));
}
export function limparResumo(html: string | null) {
  if (!html) return null;
  const el = document.createElement('div');
  el.innerHTML = html.replace(/<a[^>]*title="Open transcript[^"]*"[^>]*>[^<]*<\/a>/gi, '')
    .replace(/<li[^>]*>/gi, '\n• ').replace(/<br\s*\/?>|<\/p>|<\/strong>|<\/ul>/gi, '\n');
  return (el.textContent ?? '').replace(/\n\s*\n+/g, '\n').trim();
}

export function EncaminhamentoPosVendaCard({ dealId }: { dealId: string | null | undefined }) {
  const [verTudo, setVerTudo] = useState(false);
  const [busca, setBusca] = useState('');
  const { data } = useQuery({
    queryKey: ['pos-venda-contexto-encaminhamento', dealId],
    enabled: !!dealId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('pos_venda_contexto_encaminhamento', { p_deal_id: dealId });
      if (error) throw error;
      return (data ?? null) as Contexto | null;
    },
  });
  if (!data) return null;
  const resumo = limparResumo(data.resumo);
  const linhas = data.transcricao ?? [];
  const filtradas = busca.trim() ? linhas.filter((l) => (l.transcript ?? '').toLowerCase().includes(busca.trim().toLowerCase())) : linhas;

  return (
    <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3 space-y-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4 text-primary" /> Encaminhado pelo Pós-venda</div>
      <p className="text-xs text-muted-foreground">
        Por {data.gerente ?? 'gerente de relacionamento'} em {format(new Date(data.encaminhado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        {data.reuniao_inicio && ` · Reunião de viabilidade em ${format(new Date(data.reuniao_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
      </p>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Nota do encaminhamento</p>
        {data.nota_encaminhamento
          ? <p className="whitespace-pre-line rounded bg-background/60 p-2 mt-1">{destacar(data.nota_encaminhamento)}</p>
          : <p className="text-xs text-muted-foreground mt-1">Nota ainda não registrada (aparece quando a reunião for agendada).</p>}
      </section>

      {!data.tem_gravacao ? (
        <p className="text-xs text-muted-foreground">Reunião sem gravação associada.</p>
      ) : (
        <>
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Resumo da reunião do gerente</p>
            {resumo ? <p className="text-xs whitespace-pre-line max-h-56 overflow-y-auto mt-1">{destacar(resumo)}</p> : <p className="text-xs text-muted-foreground mt-1">Resumo ainda não disponível.</p>}
          </section>
          {data.trechos?.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Trechos da transcrição sobre consórcio</p>
              <ul className="mt-1 space-y-1">{data.trechos.map((t, i) => <li key={i} className="text-xs border-l-2 border-primary/50 pl-2">“{destacar(t)}”</li>)}</ul>
            </section>
          )}
          {linhas.length > 0 && (
            <div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setVerTudo((v) => !v)}>
                {verTudo ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {verTudo ? 'Ocultar transcrição completa' : `Ver transcrição completa (${linhas.length})`}
              </Button>
              {verTudo && (
                <div className="space-y-2 mt-1">
                  <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na transcrição..." className="h-8 text-xs" />
                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {filtradas.map((l, i) => (
                      <p key={i} className="text-xs"><span className="font-medium text-muted-foreground">{l.timestamp ? format(new Date(l.timestamp), 'HH:mm:ss') : ''} {l.speaker ?? ''}:</span> {destacar(l.transcript ?? '')}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
