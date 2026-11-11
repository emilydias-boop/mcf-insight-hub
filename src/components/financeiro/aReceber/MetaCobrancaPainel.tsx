import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Target, Settings2, Tv, Wallet, TrendingUp, Flame, Trophy, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { BITVMode } from '@/components/consorcio/BITVMode';
import { toast } from 'sonner';
import { useArCarteira } from '@/hooks/useArCarteira';
import { useArGestores, useAllProfiles } from '@/hooks/useArGestores';
import { batimentoPorCobrador, ritmoMetaCobranca, hojeSP, type MetaCobranca } from '@/lib/arCobrancaCalc';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const corPct = (p: number) => (p >= 100 ? 'hsl(var(--primary))' : p >= 70 ? 'hsl(var(--accent-foreground))' : 'hsl(var(--destructive))');

function Gauge({ pct, size = 140 }: { pct: number; size?: number }) {
  const r = 45, c = Math.PI * r, f = Math.min(pct, 100) / 100;
  return (
    <svg viewBox="0 0 100 58" width={size} height={size * 0.58}>
      <path d="M5 55 A45 45 0 0 1 95 55" fill="none" stroke="hsl(var(--muted))" strokeWidth="9" strokeLinecap="round" />
      <path d="M5 55 A45 45 0 0 1 95 55" fill="none" stroke={corPct(pct)} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${c * f} ${c}`} />
      <text x="50" y="50" textAnchor="middle" className="fill-foreground" fontSize="15" fontWeight="700">{pct.toFixed(0)}%</text>
    </svg>
  );
}

function useMetas(mes: string) {
  return useQuery({
    queryKey: ['ar-metas-cobranca', mes],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_metas_cobranca' as any).select('id,cobrador_id,valor').eq('mes', `${mes}-01`);
      if (error) throw error;
      return (data ?? []) as unknown as (MetaCobranca & { id: string })[];
    },
  });
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">{icon}<span>{label}</span></div>
        <div className="text-2xl font-black tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function MetaCobrancaPainel({ isAdmin, tvInicial = false, onFecharTv, soTv = false }: { isAdmin: boolean; tvInicial?: boolean; onFecharTv?: () => void; soTv?: boolean }) {
  const hoje = hojeSP();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [aberto, setAberto] = useState(false);
  const [tv, setTv] = useState(tvInicial);
  const { data: carteira, refetch } = useArCarteira();
  const { data: metas = [] } = useMetas(mes);
  const { data: gestores = [] } = useArGestores();
  const { data: perfis = [] } = useAllProfiles();
  const nome = (id: string | null) => (id ? perfis.find((p) => p.id === id)?.full_name ?? 'Cobrador' : 'Sem cobrador');

  useEffect(() => { if (!tv) return; const t = setInterval(() => refetch(), 30_000); return () => clearInterval(t); }, [tv, refetch]);

  const res = useMemo(
    () => batimentoPorCobrador(mes, carteira?.parcelas ?? [], (carteira?.tituloMap ?? new Map()) as any, metas, gestores),
    [mes, carteira, metas, gestores],
  );
  const g = res.geral;
  const rt = useMemo(() => ritmoMetaCobranca(mes, hoje, g.meta, res.porDia), [mes, hoje, g.meta, res.porDia]);
  const falta = Math.max(g.meta - g.realizado, 0);
  const pctEsperado = g.meta > 0 ? Math.min((rt.esperadoAteHoje / g.meta) * 100, 100) : 0;
  const mesAtual = mes === hoje.slice(0, 7);
  const msg = g.pct >= 100 ? { t: 'Meta batida! 🏆', c: 'text-primary' }
    : !mesAtual ? { t: mes < hoje.slice(0, 7) ? 'Mês encerrado' : 'Mês futuro', c: 'text-muted-foreground' }
    : g.realizado >= rt.esperadoAteHoje ? { t: 'No ritmo — continue assim! 🚀', c: 'text-primary' }
    : { t: `Acelera! Faltam ${brl(rt.esperadoAteHoje - g.realizado)} para entrar no ritmo de hoje 🔥`, c: 'text-destructive' };
  const ranking = res.porCobrador.filter((c) => c.cobrador_id);
  const sem = res.porCobrador.find((c) => !c.cobrador_id);
  const mesLabel = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /> Meta de Cobrança</h2>
          <p className="text-sm text-muted-foreground capitalize">{mesLabel} · parcelas a partir da 2ª em cobrança regular</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-40" />
          {isAdmin && <Button variant="outline" size="sm" onClick={() => setAberto(true)}><Settings2 className="h-4 w-4 mr-1" />Configurar meta</Button>}
          <Button size="sm" onClick={() => setTv(true)} className="gap-1 font-bold"><Tv className="h-4 w-4" /> Modo TV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={<Target className="h-4 w-4" />} label="Meta do mês" value={brl(g.meta)} hint={`${rt.diasUteis} dias úteis`} />
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Meta por dia útil" value={brl(rt.metaDia)} hint={`Hoje: ${brl(rt.realizadoHoje)}`} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Recebido no mês" value={brl(g.realizado)} hint={`${g.pct.toFixed(1)}% da meta · previsto ${brl(g.previsto)}`} />
        <Kpi icon={<Flame className="h-4 w-4" />} label="Falta para a meta" value={brl(falta)}
          hint={rt.uteisRestantes > 0 && falta > 0 ? `${brl(falta / rt.uteisRestantes)} por dia útil restante` : undefined} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={`font-bold ${msg.c}`}>{msg.t}</span>
            <span className="text-sm tabular-nums"><b>{g.pct.toFixed(1)}%</b> de {brl(g.meta)}</span>
          </div>
          <div className="relative h-5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.min(g.pct, 100)}%` }} />
            {mesAtual && <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${pctEsperado}%` }} title="Ritmo esperado hoje" />}
          </div>
          {mesAtual && <div className="text-xs text-muted-foreground">Linha = onde deveríamos estar hoje ({brl(rt.esperadoAteHoje)})</div>}
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {rt.semanas.map((s) => {
          const p = s.metaSemana > 0 ? (s.realizado / s.metaSemana) * 100 : 0;
          return (
            <Card key={s.index} className={s.isCurrent ? 'border-primary ring-1 ring-primary' : ''}>
              <CardContent className="p-3 space-y-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Semana {s.index + 1}{s.isCurrent && ' · atual'}</div>
                <div className="text-xs text-muted-foreground">{ddmm(s.inicio)}–{ddmm(s.fim)}</div>
                <div className="text-lg font-black tabular-nums">{brl(s.realizado)}</div>
                <div className="text-xs text-muted-foreground">de {brl(s.metaSemana)}</div>
                <Progress value={Math.min(p, 100)} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(ranking.length > 0 || sem) && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {ranking.map((c, i) => (
            <Card key={c.cobrador_id} className={i === 0 && c.realizado > 0 ? 'border-primary' : ''}>
              <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                  {i < 3 && c.realizado > 0 ? <Trophy className="h-4 w-4 text-primary" /> : null}{i + 1}º lugar
                </div>
                <Gauge pct={c.pct} size={110} />
                <div className="text-sm font-semibold truncate w-full">{nome(c.cobrador_id)}</div>
                <div className="text-xs tabular-nums">{brl(c.realizado)} de {brl(c.meta)}</div>
                <div className="text-xs text-muted-foreground">Previsto {brl(c.previsto)} · falta {brl(Math.max(c.meta - c.realizado, 0))}</div>
              </CardContent>
            </Card>
          ))}
          {sem && (
            <Card><CardContent className="p-3 text-center space-y-1">
              <div className="text-xs font-bold text-muted-foreground">Sem cobrador</div>
              <div className="text-lg font-black tabular-nums">{brl(sem.realizado)}</div>
              <div className="text-xs text-muted-foreground">Previsto {brl(sem.previsto)}</div>
            </CardContent></Card>
          )}
        </div>
      )}

      {aberto && <MetaDialog mes={mes} metas={metas} cobradores={ranking.map((c) => c.cobrador_id!)} nome={nome} onClose={() => setAberto(false)} />}
      {tv && (
        <BITVMode
          meta={g.meta} realizado={g.realizado} realizadoHoje={rt.realizadoHoje} metaDia={rt.metaDia} diasUteis={rt.diasUteis}
          monthStart={new Date(`${mes}-01T12:00:00`)}
          semanas={rt.semanas.map((s) => ({ index: s.index, metaSemana: s.metaSemana, realizado: s.realizado, isCurrent: s.isCurrent, diasUteis: s.diasUteis, start: new Date(`${s.inicio}T12:00:00`), end: new Date(`${s.fim}T12:00:00`) }))}
          closers={ranking.map((c) => ({ id: c.cobrador_id!, name: nome(c.cobrador_id), metaIndividual: c.meta, realizado: c.realizado }))}
          onClose={() => { setTv(false); onFecharTv?.(); }} accent="orange" title="MCF · Meta de Cobrança ao vivo" showCampaign={false}
        />
      )}
    </div>
  );
}

function MetaDialog({ mes, metas, cobradores, nome, onClose }: {
  mes: string; metas: (MetaCobranca & { id: string })[]; cobradores: string[]; nome: (id: string | null) => string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const ini = (id: string | null) => { const m = metas.find((x) => x.cobrador_id === id); return m ? String(m.valor) : ''; };
  const [geral, setGeral] = useState(ini(null) || '250000');
  const [ind, setInd] = useState<Record<string, string>>(Object.fromEntries(cobradores.map((c) => [c, ini(c)])));
  const salvar = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: e1 } = await supabase.from('ar_metas_cobranca' as any).delete().eq('mes', `${mes}-01`);
      if (e1) throw e1;
      const rows = [{ mes: `${mes}-01`, cobrador_id: null, valor: Number(geral) || 0, created_by: user?.id ?? null },
        ...Object.entries(ind).filter(([, v]) => v.trim() !== '').map(([c, v]) => ({ mes: `${mes}-01`, cobrador_id: c, valor: Number(v) || 0, created_by: user?.id ?? null }))];
      const { error } = await supabase.from('ar_metas_cobranca' as any).insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ar-metas-cobranca'] }); toast.success('Meta salva'); onClose(); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar meta'),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Meta de cobrança — {mes.split('-').reverse().join('/')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Meta geral (R$)</Label><Input type="number" value={geral} onChange={(e) => setGeral(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Metas individuais em branco = meta geral dividida igualmente.</p>
          {cobradores.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <span className="flex-1 text-sm truncate">{nome(c)}</span>
              <Input type="number" className="w-40" placeholder="automática" value={ind[c] ?? ''} onChange={(e) => setInd((p) => ({ ...p, [c]: e.target.value }))} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
