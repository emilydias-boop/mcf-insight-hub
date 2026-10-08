import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Linha { profile_id: string; nome: string; email: string; percentual: number; ativo: boolean; recebidos: number }

/** Distribuição de clientes novos (etapa Novos licenciados) entre gerentes de relacionamento. */
export default function DistribuicaoNovosLicenciados() {
  const qc = useQueryClient();
  const { role } = useAuth() as any;
  const isAdmin = role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['pos-venda-distribuicao'],
    queryFn: async (): Promise<Linha[]> => {
      const { data: roles, error: e1 } = await supabase.from('user_roles').select('user_id').eq('role', 'gerente_relacionamento');
      if (e1) throw e1;
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const [{ data: profs, error: e2 }, { data: dist, error: e3 }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').in('id', ids),
        (supabase.from as any)('pos_venda_distribuicao').select('*'),
      ]);
      if (e2) throw e2; if (e3) throw e3;
      const m = new Map((dist ?? []).map((d: any) => [d.profile_id, d]));
      return (profs ?? []).map((p: any) => {
        const d: any = m.get(p.id);
        return { profile_id: p.id, nome: p.full_name || p.email, email: p.email, percentual: Number(d?.percentual ?? 0), ativo: !!d?.ativo, recebidos: d?.recebidos ?? 0 };
      }).sort((a, b) => b.percentual - a.percentual || a.nome.localeCompare(b.nome));
    },
  });

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (data) setLinhas(data); }, [data]);

  const soma = useMemo(() => linhas.filter(l => l.ativo).reduce((s, l) => s + (Number(l.percentual) || 0), 0), [linhas]);
  const ok = Math.abs(soma - 100) < 0.001;

  const set = (id: string, patch: Partial<Linha>) => setLinhas(ls => ls.map(l => l.profile_id === id ? { ...l, ...patch } : l));

  const salvar = async () => {
    setSalvando(true);
    const { error } = await (supabase.rpc as any)('pos_venda_salvar_distribuicao', {
      p_itens: linhas.map(l => ({ profile_id: l.profile_id, percentual: l.ativo ? l.percentual : 0, ativo: l.ativo })),
    });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Distribuição salva');
    qc.invalidateQueries({ queryKey: ['pos-venda-distribuicao'] });
  };

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de novos licenciados</CardTitle>
          <CardDescription>
            Cada venda nova de A001, A003, A004, A009, R001, R002, R004 ou R009 entra no Pós Venda em "Novos licenciados" e vai para um gerente seguindo estes percentuais. Vale só para essa etapa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-2 items-center text-sm">
                <span className="font-medium text-muted-foreground">Gerente</span>
                <span className="font-medium text-muted-foreground">Ativo</span>
                <span className="font-medium text-muted-foreground">%</span>
                <span className="font-medium text-muted-foreground">Recebidos</span>
                {linhas.map(l => (
                  <div key={l.profile_id} className="contents">
                    <span>{l.nome}</span>
                    <Switch checked={l.ativo} disabled={!isAdmin} onCheckedChange={(v) => set(l.profile_id, { ativo: v })} />
                    <Input type="number" min={0} max={100} step={1} className="w-24" disabled={!isAdmin || !l.ativo}
                      value={l.ativo ? l.percentual : 0} onChange={(e) => set(l.profile_id, { percentual: Number(e.target.value) })} />
                    <span className="text-right tabular-nums">{l.recebidos}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className={ok ? 'text-sm' : 'text-sm text-destructive'}>Soma dos ativos: {soma}%{ok ? '' : ' — precisa dar 100%'}</span>
                {isAdmin
                  ? <Button onClick={salvar} disabled={!ok || salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
                  : <span className="text-xs text-muted-foreground">Só administradores podem alterar.</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
