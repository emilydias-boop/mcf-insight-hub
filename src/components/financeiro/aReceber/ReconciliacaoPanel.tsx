import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ticketNumber } from '@/lib/arTicketNumber';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

interface ReconRow {
  titulo_id: string;
  customer_name: string;
  customer_email: string | null;
  product_code: string;
  product_name: string | null;
  sale_date: string | null;
  parcelas_total: number;
  valor_parcela: number;
  total_installments: number;
  valor_esperado: number;
  valor_gravado: number;
  diferenca: number;
  divergente: boolean;
  parcelas_lancadas: number;
}

function useReconciliacao() {
  return useQuery({
    queryKey: ['ar-reconciliacao'],
    queryFn: async (): Promise<ReconRow[]> => {
      const { data: titulos, error } = await supabase
        .from('ar_titulos')
        .select('id, customer_name, customer_email, product_code, product_name, sale_date, valor_total, hubla_transaction_id')
        .in('product_code', ['A001', 'A002', 'A003', 'A004', 'A009'])
        .not('hubla_transaction_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;

      const txIds = (titulos ?? []).map(t => t.hubla_transaction_id).filter(Boolean) as string[];
      if (txIds.length === 0) return [];

      const { data: txs, error: txErr } = await supabase
        .from('hubla_transactions')
        .select('id, product_price, total_installments')
        .in('id', txIds);
      if (txErr) throw txErr;

      const { data: parcelas, error: pErr } = await supabase
        .from('ar_parcelas')
        .select('titulo_id')
        .in('titulo_id', (titulos ?? []).map(t => t.id));
      if (pErr) throw pErr;

      const txMap = new Map(txs?.map(t => [t.id, t]) ?? []);
      const parcCount = new Map<string, number>();
      (parcelas ?? []).forEach(p => {
        parcCount.set(p.titulo_id, (parcCount.get(p.titulo_id) ?? 0) + 1);
      });

      const rows: ReconRow[] = (titulos ?? []).map(t => {
        const tx = txMap.get(t.hubla_transaction_id as string);
        const valorParcela = Number(tx?.product_price ?? 0);
        const nInst = Number(tx?.total_installments ?? 1);
        // Valor esperado = product_price original do webhook Hubla (sem multiplicar por parcelas).
        const esperado = Math.round(valorParcela * 100) / 100;
        const gravado = Math.round(Number(t.valor_total ?? 0) * 100) / 100;
        const dif = Math.round((esperado - gravado) * 100) / 100;
        return {
          titulo_id: t.id,
          customer_name: t.customer_name,
          customer_email: t.customer_email,
          product_code: t.product_code,
          product_name: t.product_name,
          sale_date: t.sale_date,
          parcelas_total: nInst,
          valor_parcela: valorParcela,
          total_installments: nInst,
          valor_esperado: esperado,
          valor_gravado: gravado,
          diferenca: dif,
          divergente: Math.abs(dif) > 0.01,
          parcelas_lancadas: parcCount.get(t.id) ?? 0,
        };
      });

      return rows.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));
    },
    staleTime: 60_000,
  });
}

export function ReconciliacaoPanel() {
  const { data, isLoading, refetch, isFetching } = useReconciliacao();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'divergentes' | 'todos' | 'ok'>('divergentes');
  const [search, setSearch] = useState('');
  const [fixing, setFixing] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = data ?? [];
    if (filter === 'divergentes') list = list.filter(r => r.divergente);
    if (filter === 'ok') list = list.filter(r => !r.divergente);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.customer_email || '').toLowerCase().includes(q) ||
        ticketNumber(r.titulo_id).toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, filter, search]);

  const kpis = useMemo(() => {
    const all = data ?? [];
    const div = all.filter(r => r.divergente);
    return {
      total: all.length,
      divergentes: div.length,
      valorDivergente: div.reduce((s, r) => s + Math.abs(r.diferenca), 0),
      valorFaltante: div.reduce((s, r) => s + (r.diferenca > 0 ? r.diferenca : 0), 0),
    };
  }, [data]);

  const fixOne = async (row: ReconRow) => {
    if (row.parcelas_lancadas > 0) {
      toast.error('Título já possui parcelas lançadas — corrija manualmente.');
      return;
    }
    setFixing(row.titulo_id);
    try {
      const { error } = await supabase
        .from('ar_titulos')
        .update({ valor_total: row.valor_esperado })
        .eq('id', row.titulo_id);
      if (error) throw error;
      toast.success('Valor total corrigido');
      await qc.invalidateQueries({ queryKey: ['ar-reconciliacao'] });
      await qc.invalidateQueries({ queryKey: ['ar-titulos'] });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao corrigir');
    } finally {
      setFixing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Títulos analisados</CardTitle></CardHeader>
          <CardContent className="text-lg font-bold">{kpis.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Divergentes</CardTitle></CardHeader>
          <CardContent className="text-lg font-bold text-red-600">{kpis.divergentes}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Δ absoluto total</CardTitle></CardHeader>
          <CardContent className="text-lg font-bold text-amber-600">{brl(kpis.valorDivergente)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Valor faltante (esperado &gt; gravado)</CardTitle></CardHeader>
          <CardContent className="text-lg font-bold text-red-600">{brl(kpis.valorFaltante)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente, e-mail ou nº do título…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="divergentes">Somente divergentes</SelectItem>
              <SelectItem value="ok">Somente OK</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Nenhum título {filter === 'divergentes' ? 'divergente' : ''} encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Data venda</TableHead>
                  <TableHead className="text-center">Nx</TableHead>
                  <TableHead className="text-right">Valor parcela</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Gravado</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.titulo_id} className={r.divergente ? 'bg-red-500/5' : ''}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{ticketNumber(r.titulo_id)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{r.customer_email || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{r.product_code}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-[180px]">{r.product_name}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.sale_date ? format(new Date(r.sale_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                    </TableCell>
                    <TableCell className="text-center text-xs">{r.total_installments}x</TableCell>
                    <TableCell className="text-right text-xs">{brl(r.valor_parcela)}</TableCell>
                    <TableCell className="text-right font-medium">{brl(r.valor_esperado)}</TableCell>
                    <TableCell className={`text-right ${r.divergente ? 'text-red-600 font-medium' : ''}`}>{brl(r.valor_gravado)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${r.divergente ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                      {r.diferenca > 0 ? '+' : ''}{brl(r.diferenca)}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {r.parcelas_lancadas > 0 ? (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                          {r.parcelas_lancadas} lançadas
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.divergente ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Divergente
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.divergente && r.parcelas_lancadas === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fixOne(r)}
                          disabled={fixing === r.titulo_id}
                        >
                          {fixing === r.titulo_id ? 'Corrigindo…' : 'Corrigir'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}