import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Target, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useArCarteira } from '@/hooks/useArCarteira';
import { useArGestores, useAllProfiles } from '@/hooks/useArGestores';
import { batimentoPorCobrador, hojeSP, type MetaCobranca } from '@/lib/arCobrancaCalc';

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

export function MetaCobrancaPainel({ isAdmin }: { isAdmin: boolean }) {
  const [mes, setMes] = useState(hojeSP().slice(0, 7));
  const [aberto, setAberto] = useState(false);
  const { data: carteira } = useArCarteira();
  const { data: metas = [] } = useMetas(mes);
  const { data: gestores = [] } = useArGestores();
  const { data: perfis = [] } = useAllProfiles();
  const nome = (id: string | null) => (id ? perfis.find((p) => p.id === id)?.full_name ?? 'Cobrador' : 'Sem cobrador');

  const res = useMemo(
    () => batimentoPorCobrador(mes, carteira?.parcelas ?? [], (carteira?.tituloMap ?? new Map()) as any, metas, gestores),
    [mes, carteira, metas, gestores],
  );
  const g = res.geral;

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <Gauge pct={g.pct} size={170} />
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4" /> Meta de cobrança do mês</div>
            <div className="text-3xl font-bold">{brl(g.meta)}</div>
            <div className="text-sm">Recebido: <b>{brl(g.realizado)}</b> · Falta: <b>{brl(Math.max(g.meta - g.realizado, 0))}</b></div>
          </div>
          <div className="flex items-center gap-2">
            <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-40" />
            {isAdmin && <Button variant="outline" size="sm" onClick={() => setAberto(true)}><Settings2 className="h-4 w-4 mr-1" />Configurar meta</Button>}
          </div>
        </div>
        {res.porCobrador.length > 0 && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {res.porCobrador.map((c) => (
              <div key={c.cobrador_id ?? 'sem'} className="rounded-md border border-border p-2 flex flex-col items-center text-center">
                {c.cobrador_id ? <Gauge pct={c.pct} size={110} /> : <div className="h-16" />}
                <div className="text-sm font-medium truncate w-full">{nome(c.cobrador_id)}</div>
                <div className="text-xs text-muted-foreground">{brl(c.realizado)}{c.cobrador_id && ` de ${brl(c.meta)}`}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {aberto && <MetaDialog mes={mes} metas={metas} cobradores={res.porCobrador.map((c) => c.cobrador_id).filter((x): x is string => !!x)} nome={nome} onClose={() => setAberto(false)} />}
    </Card>
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
