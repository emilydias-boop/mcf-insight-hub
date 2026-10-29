import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CalendarDays, Ticket, Gavel, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { mesAtualSP, mesesHistoricos, mesSemRegistro, rotuloMes, rotuloTipoLance, type RelatorioCota } from '@/lib/relatorioCota';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');

export function RelatorioCotaTab() {
  const [busca, setBusca] = useState('');
  const [cardId, setCardId] = useState<string | null>(null);
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const mesAtual = mesAtualSP();

  const { data: cotas = [] } = useQuery({
    queryKey: ['relatorio-cota-busca', busca],
    enabled: busca.trim().length >= 2,
    queryFn: async () => {
      const t = busca.trim().replace(/[%,()]/g, '');
      const { data, error } = await supabase.from('consortium_cards')
        .select('id, nome_completo, razao_social, grupo, cota')
        .or(`nome_completo.ilike.%${t}%,razao_social.ilike.%${t}%,grupo.eq.${t},cota.eq.${t}`)
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const { data: rel, isLoading } = useQuery({
    queryKey: ['relatorio-cota', cardId],
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('consorcio_relatorio_cota' as any, { p_card_id: cardId });
      if (error) throw error;
      return data as unknown as RelatorioCota;
    },
  });

  const meses = useMemo(() => (rel ? mesesHistoricos(rel.meses, mesAtual) : []), [rel, mesAtual]);

  const enviar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke('harvey-relatorio-cota', { body: { card_ids: ids, mes_referencia: mesAtual } });
      if (error) {
        const ctx = await (error as any).context?.json?.().catch(() => null);
        throw new Error(ctx?.erro === 'harvey_nao_configurado' ? 'Endereço e chave do HARVEY ainda não foram configurados.' : error.message);
      }
      return data;
    },
    onSuccess: (d: any) => {
      const ok = d.resultados.filter((r: any) => r.status === 'enviado').length;
      toast.success(`${ok} de ${d.resultados.length} cota(s) enviada(s) ao HARVEY`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader><CardTitle className="text-base">Buscar cota</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Cliente, grupo ou cota" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="max-h-[520px] overflow-auto space-y-1">
            {cotas.map((c) => (
              <button key={c.id} onClick={() => setCardId(c.id)}
                className={`w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted ${cardId === c.id ? 'bg-muted' : ''}`}>
                <div className="font-medium truncate">{c.nome_completo || c.razao_social || 'Sem nome'}</div>
                <div className="text-xs text-muted-foreground">Grupo {c.grupo ?? '—'} • Cota {c.cota ?? '—'}</div>
              </button>
            ))}
            {busca.trim().length >= 2 && cotas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma cota encontrada.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {!cardId && <p className="text-sm text-muted-foreground">Escolha uma cota para ver a prévia do que o cliente vai receber no HARVEY.</p>}
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {rel && (
          <>
            <Card>
              <CardContent className="pt-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Acompanhamento da sua cota</p>
                  <h2 className="text-xl font-semibold">{rel.cota.cliente}</h2>
                  <p className="text-sm text-muted-foreground">Grupo {rel.cota.grupo} • Cota {rel.cota.cota} • Crédito {brl(Number(rel.cota.valor_credito))}</p>
                  {rel.cota.data_contemplacao && <Badge className="mt-2">Contemplada em {dataBR(rel.cota.data_contemplacao)}</Badge>}
                </div>
                {isAdmin && (
                  <Button onClick={() => enviar.mutate([rel.cota.id])} disabled={enviar.isPending}>
                    <Send className="h-4 w-4 mr-2" />Enviar ao HARVEY
                  </Button>
                )}
              </CardContent>
            </Card>

            {meses.length === 0 && <p className="text-sm text-muted-foreground">Nenhum mês com registro desde a contratação.</p>}
            {meses.map((m) => (
              <Card key={m.mes}>
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <CardTitle className="text-base capitalize">{rotuloMes(m.mes)}</CardTitle>
                  {mesSemRegistro(m) && <Badge variant="outline">Sem registro</Badge>}
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="flex gap-2"><CalendarDays className="h-4 w-4 mt-0.5 text-primary" />
                    <div><p className="text-muted-foreground">Assembleia</p>
                      <p className="font-medium">{m.assembleia ? `Nº ${m.assembleia.numero} • ${dataBR(m.assembleia.data)}` : '—'}</p></div></div>
                  <div className="flex gap-2"><Ticket className="h-4 w-4 mt-0.5 text-primary" />
                    <div><p className="text-muted-foreground">Loteria Federal</p>
                      <p className="font-medium">{m.loteria ? m.loteria.numero : '—'}</p>
                      {m.loteria?.aplicado && m.loteria.aplicado !== m.loteria.numero && <p className="text-xs text-muted-foreground">Aplicado ao grupo: {m.loteria.aplicado}</p>}</div></div>
                  <div className="flex gap-2"><Gavel className="h-4 w-4 mt-0.5 text-primary" />
                    <div className="space-y-1"><p className="text-muted-foreground">Lances</p>
                      {m.lances.length === 0 ? <p className="font-medium">—</p> : m.lances.map((l, i) => (
                        <p key={i} className="font-medium">{rotuloTipoLance(l.tipo)} • {Number(l.percentual).toLocaleString('pt-BR')}% ({brl(Number(l.valor))}) • chance {l.chance}</p>
                      ))}
                      {m.resultados.map((r, i) => <p key={i} className="text-xs text-muted-foreground">Resultado: {r.modalidade ?? '—'}{r.percentual ? ` ${r.percentual}%` : ''}</p>)}</div></div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
