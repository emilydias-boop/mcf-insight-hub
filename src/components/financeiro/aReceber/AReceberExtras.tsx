import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gavel, Pencil, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useArCarteira } from '@/hooks/useArCarteira';
import { useFinanceiroUsers, useUpdateCobrancaStage } from '@/hooks/useAReceber';
import { useCanManageAr } from '@/hooks/useArGestores';
import { useArReembolsos } from '@/hooks/useArReembolsos';
import { useAuth } from '@/contexts/AuthContext';
import { getRefundWindow } from '@/lib/refundWindow';
import { ticketNumber } from '@/lib/arTicketNumber';
import { emAberto, hojeSP, mesDe, recebido, diasEntre, type ParcelaCalc } from '@/lib/arCobrancaCalc';
import { ContatoRapido, SaldoValor, brl, dataBR, type FiltrosCobranca } from './GestaoCobranca';

const Carregando = () => <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

/* ---------------- Cobrança Jurídica ---------------- */
export function CobrancaJuridica({ filtros, onAbrir }: { filtros: FiltrosCobranca; onAbrir?: (id: string) => void }) {
  const { data, isLoading } = useArCarteira();
  const { canManage } = useCanManageAr();
  const stage = useUpdateCobrancaStage();
  const [devolver, setDevolver] = useState<string | null>(null);
  const lista = useMemo(() => {
    if (!data) return [];
    const q = filtros.busca.trim().toLowerCase();
    return data.titulos
      .filter((t) => t.cobranca_stage === 'judicial')
      .filter((t) => !q || `${t.customer_name} ${t.customer_email ?? ''} ${t.customer_phone ?? ''} ${t.product_code ?? ''}`.toLowerCase().includes(q))
      .map((t) => {
        const ps = data.porTitulo.get(t.id) ?? [];
        return { t, saldo: ps.reduce((s, p) => s + emAberto(p), 0), pago: ps.reduce((s, p) => s + recebido(p), 0) };
      })
      .sort((a, b) => b.saldo - a.saldo);
  }, [data, filtros.busca]);

  if (isLoading) return <Carregando />;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Gavel className="w-4 h-4" /> {lista.length} cliente(s) em cobrança jurídica · saldo {brl(lista.reduce((s, l) => s + l.saldo, 0))}</CardTitle>
        <p className="text-xs text-muted-foreground">Estes clientes não aparecem nas visões dos cobradores e gerentes de conta.</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {lista.length === 0 ? <p className="text-center py-10 text-muted-foreground">Nenhum cliente em cobrança jurídica.</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Contato</TableHead><TableHead>Produto</TableHead>
              <TableHead className="text-right">Valor total</TableHead><TableHead className="text-right">Recebido</TableHead><TableHead className="text-right">Saldo devedor</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {lista.map(({ t, saldo, pago }) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onAbrir?.(t.id)}>
                  <TableCell className="font-mono text-xs">{ticketNumber(t.id)}</TableCell>
                  <TableCell className="font-medium">{t.customer_name}</TableCell>
                  <TableCell><ContatoRapido telefone={t.customer_phone} email={t.customer_email} /></TableCell>
                  <TableCell className="text-xs">{t.product_code}</TableCell>
                  <TableCell className="text-right">{brl(Number(t.valor_total))}</TableCell>
                  <TableCell className="text-right text-emerald-600">{brl(pago)}</TableCell>
                  <TableCell className="text-right"><SaldoValor valor={saldo} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canManage && <Button size="sm" variant="outline" onClick={() => setDevolver(t.id)}><Undo2 className="w-3.5 h-3.5 mr-1" />Devolver</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={!!devolver} onOpenChange={(v) => !v && setDevolver(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver para cobrança regular?</DialogTitle>
            <DialogDescription>O cliente volta a aparecer para cobradores e gerentes de conta.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDevolver(null)}>Cancelar</Button>
            <Button disabled={stage.isPending} onClick={async () => {
              try {
                await stage.mutateAsync({ tituloId: devolver!, stage: 'atraso', motivo: 'Devolvido da cobrança jurídica para a cobrança regular' });
                toast.success('Cliente devolvido para a cobrança regular');
                setDevolver(null);
              } catch (e: any) { toast.error(e?.message || 'Erro'); }
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- Relatórios e Notas ---------------- */
export function useArEventos() {
  return useQuery({
    queryKey: ['ar-eventos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_eventos' as any).select('id,nome,ativo').order('nome');
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string; ativo: boolean }[];
    },
  });
}

function EditarBaixaDialog({ p, onClose }: { p: ParcelaCalc | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: users } = useFinanceiroUsers();
  const { data: eventos } = useArEventos();
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [cob, setCob] = useState('');
  const [ev, setEv] = useState('');
  const [salvando, setSalvando] = useState(false);
  if (!p) return null;
  const salvar = async () => {
    setSalvando(true);
    const patch: any = {};
    if (valor) patch.valor_pago = Number(valor);
    if (data) patch.data_pagamento = data;
    if (cob) patch.cobrador_id = cob === 'none' ? null : cob;
    if (ev) patch.evento = ev === 'none' ? null : ev;
    const { error } = await supabase.from('ar_parcelas' as any).update(patch).eq('id', p.id);
    if (!error) {
      await supabase.from('ar_historico' as any).insert({
        titulo_id: p.titulo_id, parcela_id: p.id, tipo: 'baixa_editada',
        descricao: `Baixa da parcela ${p.numero} corrigida`, valor: patch.valor_pago ?? null,
        metadata: { antes: { valor_pago: p.valor_pago, data_pagamento: p.data_pagamento, cobrador_id: p.cobrador_id, evento: p.evento }, depois: patch },
      } as any);
    }
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success('Baixa corrigida');
    qc.invalidateQueries({ queryKey: ['ar-titulos'] });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corrigir baixa</DialogTitle>
          <DialogDescription>Parcela {p.numero} · {brl(recebido(p))} em {dataBR(p.data_pagamento)}. Deixe em branco o que não mudar.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Valor recebido</Label><Input type="number" step="0.01" placeholder={String(recebido(p))} value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><Label>Cobrador</Label>
            <Select value={cob} onValueChange={setCob}><SelectTrigger><SelectValue placeholder="Manter" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sem cobrador</SelectItem>{(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Evento</Label>
            <Select value={ev} onValueChange={setEv}><SelectTrigger><SelectValue placeholder="Manter" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sem evento</SelectItem>{(eventos ?? []).map((e) => <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotasGerais() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { canManage } = useCanManageAr();
  const { data: users } = useFinanceiroUsers();
  const nome = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const { data: notas } = useQuery({
    queryKey: ['ar-notas-gerais'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_notas_gerais' as any).select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['ar-notas-gerais'] });
  const add = async () => {
    const { error } = await supabase.from('ar_notas_gerais' as any).insert({ texto: texto.trim() } as any);
    if (error) return toast.error(error.message);
    setTexto(''); refresh();
  };
  const salvarEdicao = async () => {
    if (!editando) return;
    const { error } = await supabase.from('ar_notas_gerais' as any).update({ texto: editando.texto } as any).eq('id', editando.id);
    if (error) return toast.error(error.message);
    setEditando(null); refresh();
  };
  const excluir = async (id: string) => {
    const { error } = await supabase.from('ar_notas_gerais' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    refresh();
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Bloco de notas da equipe</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Textarea rows={2} placeholder="Escreva uma nota geral…" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <Button onClick={add} disabled={!texto.trim()}>Salvar</Button>
        </div>
        {(notas ?? []).map((n) => {
          const pode = n.autor_id === user?.id || canManage;
          return (
            <div key={n.id} className="border-l-2 border-border pl-3 text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(n.created_at).toLocaleString('pt-BR')} · {nome.get(n.autor_id) ?? 'Usuário'}</span>
                {pode && (
                  <span className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditando({ id: n.id, texto: n.texto })}><Pencil className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => excluir(n.id)}><Trash2 className="w-3 h-3" /></Button>
                  </span>
                )}
              </div>
              {editando?.id === n.id ? (
                <div className="flex gap-2 mt-1">
                  <Textarea rows={2} value={editando.texto} onChange={(e) => setEditando({ ...editando, texto: e.target.value })} />
                  <Button size="sm" onClick={salvarEdicao}>Salvar</Button>
                </div>
              ) : <div className="whitespace-pre-wrap">{n.texto}</div>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function RelatoriosNotas({ filtros }: { filtros: FiltrosCobranca }) {
  const { data, isLoading } = useArCarteira();
  const { data: users } = useFinanceiroUsers();
  const { data: eventos } = useArEventos();
  const { canManage } = useCanManageAr();
  const qc = useQueryClient();
  const hoje = hojeSP();
  const [de, setDe] = useState(`${hoje.slice(0, 4)}-01-01`);
  const [ate, setAte] = useState(hoje);
  const [evento, setEvento] = useState('todos');
  const [novoEvento, setNovoEvento] = useState('');
  const [editar, setEditar] = useState<ParcelaCalc | null>(null);
  const nome = useMemo(() => new Map((users ?? []).map((u) => [u.id, u.full_name])), [users]);

  const pagas = useMemo(() => {
    if (!data) return [];
    const q = filtros.busca.trim().toLowerCase();
    return data.parcelas.filter((p) => {
      if (p.status !== 'pago' || !p.data_pagamento) return false;
      const d = p.data_pagamento.slice(0, 10);
      if (d < de || d > ate) return false;
      const ev = p.evento || 'Cobrança regular';
      if (evento !== 'todos' && ev !== evento) return false;
      const t = data.tituloMap.get(p.titulo_id);
      if (!t) return false;
      const cob = p.cobrador_id ?? t.cobranca_responsavel_id ?? 'none';
      if (filtros.cobrador !== 'todos' && (filtros.cobrador === 'none' ? cob !== 'none' : cob !== filtros.cobrador)) return false;
      if (filtros.produto !== 'todos' && t.product_code !== filtros.produto) return false;
      if (q && !`${t.customer_name} ${t.customer_email ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (b.data_pagamento ?? '').localeCompare(a.data_pagamento ?? ''));
  }, [data, de, ate, evento, filtros]);

  const porMes = useMemo(() => {
    const m = new Map<string, { total: number; cob: Map<string, number> }>();
    pagas.forEach((p) => {
      const k = mesDe(p.data_pagamento!);
      const t = data!.tituloMap.get(p.titulo_id)!;
      const c = nome.get(p.cobrador_id ?? t.cobranca_responsavel_id ?? '') ?? 'Sem cobrador';
      const cur = m.get(k) ?? { total: 0, cob: new Map() };
      cur.total += recebido(p);
      cur.cob.set(c, (cur.cob.get(c) ?? 0) + recebido(p));
      m.set(k, cur);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [pagas, data, nome]);

  const criarEvento = async () => {
    const { error } = await supabase.from('ar_eventos' as any).insert({ nome: novoEvento.trim() } as any);
    if (error) return toast.error(error.message);
    setNovoEvento('');
    qc.invalidateQueries({ queryKey: ['ar-eventos'] });
  };

  if (isLoading) return <Carregando />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <div className="min-w-[200px]"><Label className="text-xs">Evento</Label>
          <Select value={evento} onValueChange={setEvento}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos os eventos</SelectItem>{(eventos ?? []).map((e) => <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>)}</SelectContent></Select></div>
        {canManage && (
          <div className="flex gap-2 items-end">
            <div><Label className="text-xs">Novo evento</Label><Input placeholder="Ex.: Ação Quite Já 2026" value={novoEvento} onChange={(e) => setNovoEvento(e.target.value)} /></div>
            <Button variant="outline" disabled={!novoEvento.trim()} onClick={criarEvento}>Adicionar</Button>
          </div>
        )}
        <div className="text-sm ml-auto">Total no período: <span className="font-bold text-emerald-600">{brl(pagas.reduce((s, p) => s + recebido(p), 0))}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Arrecadado por mês e por cobrador</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {porMes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum recebimento no período.</p>}
              {porMes.map(([m, v]) => (
                <div key={m} className="border-b pb-2">
                  <div className="flex justify-between font-semibold text-sm"><span className="capitalize">{new Date(m + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span><span className="text-emerald-600">{brl(v.total)}</span></div>
                  {Array.from(v.cob.entries()).sort((a, b) => b[1] - a[1]).map(([c, val]) => (
                    <div key={c} className="flex justify-between text-xs text-muted-foreground pl-3"><span>{c}</span><span>{brl(val)}</span></div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Baixas do período ({pagas.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto max-h-[480px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Parcela</TableHead><TableHead>Cobrador</TableHead><TableHead>Evento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {pagas.slice(0, 500).map((p) => {
                    const t = data!.tituloMap.get(p.titulo_id)!;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{dataBR(p.data_pagamento)}</TableCell>
                        <TableCell className="text-xs font-medium">{t.customer_name}</TableCell>
                        <TableCell className="text-xs">{p.numero}</TableCell>
                        <TableCell className="text-xs">{nome.get(p.cobrador_id ?? t.cobranca_responsavel_id ?? '') ?? '—'}</TableCell>
                        <TableCell className="text-xs">{p.evento || 'Cobrança regular'}</TableCell>
                        <TableCell className="text-right text-emerald-600">{brl(recebido(p))}</TableCell>
                        <TableCell>{canManage && <Button size="icon" variant="ghost" className="h-7 w-7" title="Corrigir baixa" onClick={() => setEditar(p)}><Pencil className="w-3.5 h-3.5" /></Button>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <NotasGerais />
      </div>
      <EditarBaixaDialog key={editar?.id ?? 'none'} p={editar} onClose={() => setEditar(null)} />
    </div>
  );
}

/* ---------------- Aviso de reembolsos próximos ---------------- */
export const AVISO_REEMBOLSO_DIAS = 7;

export function useReembolsosProximos() {
  const { data } = useArReembolsos({ status: 'pendente' });
  return useMemo(() => {
    const hoje = hojeSP();
    return (data ?? []).filter((r) => {
      const w = getRefundWindow(r.titulo?.sale_date, r.titulo?.payment_method, r.data_pedido);
      const prazoPerto = w.allowed !== null && w.daysLeft !== null && w.daysLeft! <= AVISO_REEMBOLSO_DIAS;
      const prev = r.data_prevista_pagamento ? diasEntre(hoje, r.data_prevista_pagamento.slice(0, 10)) : null;
      return prazoPerto || (prev !== null && prev <= AVISO_REEMBOLSO_DIAS);
    });
  }, [data]);
}
