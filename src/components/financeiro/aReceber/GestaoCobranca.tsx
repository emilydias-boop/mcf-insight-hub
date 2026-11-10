import { useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Mail, MessageCircle, Phone, Search, X, CheckCheck, CalendarClock, StickyNote, Gavel } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useArCarteira, type TituloCarteira } from '@/hooks/useArCarteira';
import { useFinanceiroUsers, useMarkArParcelaPaga, useUpdateArParcela, useUpdateCobrancaStage } from '@/hooks/useAReceber';
import { useGerentesConta } from './GerenteConta';
import { ticketNumber } from '@/lib/arTicketNumber';
import {
  SALDO_ALTO_LIMITE, addDias, diasEntre, emAberto, hojeSP, inicioSemana, isPendenciaMesAnterior,
  mesDe, recebido, statusCliente, telefoneDigitos, totaisPorSemana, tituloForaCobranca,
  type ParcelaCalc, type StatusCliente,
} from '@/lib/arCobrancaCalc';

export const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
export const dataBR = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—');
const mesLabel = (m: string) => {
  const [y, mm] = m.split('-');
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
};

/* ---------------- Filtros globais ---------------- */
export interface FiltrosCobranca { busca: string; cobrador: string; gerente: string; produto: string; status: string }
export const FILTROS_VAZIOS: FiltrosCobranca = { busca: '', cobrador: 'todos', gerente: 'todos', produto: 'todos', status: 'todos' };

function FiltrosWrap({ barra, children }: { barra?: boolean; children: ReactNode }) {
  return barra
    ? <div className="flex flex-wrap items-center gap-2 [&>button]:w-auto [&>button]:min-w-[150px]">{children}</div>
    : <Card><CardContent className="pt-4 grid grid-cols-1 md:grid-cols-6 gap-3">{children}</CardContent></Card>;
}

export function FiltrosGlobais({ value, onChange, produtos, barra, extra }: {
  value: FiltrosCobranca; onChange: (v: FiltrosCobranca) => void; produtos: string[];
  /** Layout em linha única (barra superior compartilhada por todas as abas). */
  barra?: boolean; extra?: ReactNode;
}) {
  const { data: users } = useFinanceiroUsers();
  const { data: gerentes } = useGerentesConta();
  const nomesGerentes = useMemo(
    () => Array.from(new Set(Array.from(gerentes?.values() ?? []).map((g) => g.gerente_nome).filter(Boolean) as string[])).sort(),
    [gerentes],
  );
  const ativos = (Object.keys(value) as (keyof FiltrosCobranca)[]).filter((k) => value[k] !== FILTROS_VAZIOS[k]).length;
  const set = (k: keyof FiltrosCobranca, v: string) => onChange({ ...value, [k]: v });
  return (
    <FiltrosWrap barra={barra}>
        <div className={barra ? 'relative flex-1 min-w-[240px]' : 'relative md:col-span-2'}>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={barra ? 'Buscar nome, telefone, e-mail, produto…' : 'Nome, telefone, e-mail, CPF, produto ou nº do título'}
            value={value.busca} onChange={(e) => set('busca', e.target.value)} />
        </div>
        <Select value={value.cobrador} onValueChange={(v) => set('cobrador', v)}>
          <SelectTrigger><SelectValue placeholder="Cobrador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os cobradores</SelectItem>
            <SelectItem value="none">Sem cobrador</SelectItem>
            {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={value.gerente} onValueChange={(v) => set('gerente', v)}>
          <SelectTrigger><SelectValue placeholder="Gerente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os gerentes</SelectItem>
            <SelectItem value="none">Sem gerente</SelectItem>
            {nomesGerentes.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={value.produto} onValueChange={(v) => set('produto', v)}>
          <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os produtos</SelectItem>
            {produtos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Select value={value.status} onValueChange={(v) => set('status', v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="em_dia">Em dia</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="negociacao">Negociação</SelectItem>
            </SelectContent>
          </Select>
          {ativos > 0 && (
            <Button variant="ghost" size="icon" title={`Limpar ${ativos} filtro(s)`} onClick={() => onChange(FILTROS_VAZIOS)}>
              <X className="w-4 h-4" />
            </Button>
          )}
          {extra}
        </div>
    </FiltrosWrap>
  );
}

/* ---------------- Peças visuais ---------------- */
const STATUS_CLIENTE: Record<StatusCliente, { label: string; cls: string }> = {
  em_dia: { label: 'Em dia', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  atrasado: { label: 'Atrasado', cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
  negociacao: { label: 'Negociação', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  judicial: { label: 'Cobrança Jurídica', cls: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  quitado: { label: 'Quitado', cls: 'bg-muted text-muted-foreground' },
  cancelado: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
};
export function StatusClienteBadge({ status }: { status: StatusCliente }) {
  const c = STATUS_CLIENTE[status];
  return <Badge variant="outline" className={c.cls}>{c.label}</Badge>;
}

export function ContatoRapido({ telefone, email }: { telefone?: string | null; email?: string | null }) {
  const d = telefoneDigitos(telefone);
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      {d ? (
        <>
          <a href={`tel:+${d}`} title={`Ligar ${telefone}`} className="p-1 rounded hover:bg-muted"><Phone className="w-3.5 h-3.5" /></a>
          <a href={`https://wa.me/${d}`} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1 rounded hover:bg-muted text-emerald-600"><MessageCircle className="w-3.5 h-3.5" /></a>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{telefone}</span>
        </>
      ) : <span className="text-xs text-muted-foreground">—</span>}
      {email && <a href={`mailto:${email}`} title={email} className="p-1 rounded hover:bg-muted"><Mail className="w-3.5 h-3.5" /></a>}
    </div>
  );
}

export function SaldoValor({ valor }: { valor: number }) {
  return <span className={valor > SALDO_ALTO_LIMITE ? 'font-bold text-red-600' : 'text-amber-600'}>{brl(valor)}</span>;
}

/* ---------------- Base filtrada compartilhada ---------------- */
interface Linha { p: ParcelaCalc; t: TituloCarteira; aberto: number; total: number }

function useBase(f: FiltrosCobranca) {
  const { data, isLoading } = useArCarteira();
  const { data: gerentes } = useGerentesConta();
  const { data: users } = useFinanceiroUsers();
  const hoje = hojeSP();
  const nomeUser = useMemo(() => new Map((users ?? []).map((u) => [u.id, u.full_name])), [users]);

  const titulosOk = useMemo(() => {
    const out = new Set<string>();
    if (!data) return out;
    const q = f.busca.trim().toLowerCase();
    const qDig = q.replace(/\D/g, '');
    for (const t of data.titulos) {
      if (f.cobrador !== 'todos' && (f.cobrador === 'none' ? t.cobranca_responsavel_id : t.cobranca_responsavel_id !== f.cobrador)) continue;
      if (f.produto !== 'todos' && t.product_code !== f.produto) continue;
      if (f.gerente !== 'todos') {
        const g = gerentes?.get(t.id)?.gerente_nome;
        if (f.gerente === 'none' ? g : g !== f.gerente) continue;
      }
      if (f.status !== 'todos' && statusCliente(t, data.porTitulo.get(t.id) ?? [], hoje) !== f.status) continue;
      if (q) {
        const hay = `${t.customer_name} ${t.customer_email ?? ''} ${t.product_code ?? ''} ${t.product_name} ${ticketNumber(t.id)}`.toLowerCase();
        const dig = `${t.customer_phone ?? ''}${t.customer_document ?? ''}`.replace(/\D/g, '');
        if (!hay.includes(q) && !(qDig.length >= 3 && dig.includes(qDig))) continue;
      }
      out.add(t.id);
    }
    return out;
  }, [data, f, gerentes, hoje]);

  const linhas: Linha[] = useMemo(() => {
    if (!data) return [];
    const out: Linha[] = [];
    for (const p of data.parcelas) {
      if (!titulosOk.has(p.titulo_id)) continue;
      const t = data.tituloMap.get(p.titulo_id)!;
      out.push({ p, t, aberto: emAberto(p), total: data.porTitulo.get(t.id)?.length ?? 1 });
    }
    return out;
  }, [data, titulosOk]);

  return { data, isLoading, linhas, hoje, gerentes, nomeUser };
}

/* ---------------- Ações de parcela ---------------- */
type Acao = { tipo: 'baixa' | 'reagendar' | 'anotar' | 'judicial'; l: Linha } | null;

function AcoesParcela({ l, onAcao, judicial = true }: { l: Linha; onAcao: (a: Acao) => void; judicial?: boolean }) {
  return (
    <div className="flex gap-1 justify-end">
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Marcar como paga" onClick={() => onAcao({ tipo: 'baixa', l })}><CheckCheck className="w-4 h-4 text-emerald-600" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Reagendar" onClick={() => onAcao({ tipo: 'reagendar', l })}><CalendarClock className="w-4 h-4" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Anotar" onClick={() => onAcao({ tipo: 'anotar', l })}><StickyNote className="w-4 h-4" /></Button>
      {judicial && <Button size="icon" variant="ghost" className="h-7 w-7" title="Encaminhar para jurídico" onClick={() => onAcao({ tipo: 'judicial', l })}><Gavel className="w-4 h-4 text-purple-600" /></Button>}
    </div>
  );
}

function AcaoDialog({ acao, onClose }: { acao: Acao; onClose: () => void }) {
  const qc = useQueryClient();
  const baixa = useMarkArParcelaPaga();
  const upd = useUpdateArParcela();
  const stage = useUpdateCobrancaStage();
  const [data, setData] = useState(hojeSP());
  const [forma, setForma] = useState('pix');
  const [valor, setValor] = useState('');
  const [texto, setTexto] = useState('');
  if (!acao) return null;
  const { l } = acao;
  const pend = baixa.isPending || upd.isPending || stage.isPending;

  const salvar = async () => {
    try {
      if (acao.tipo === 'baixa') {
        await baixa.mutateAsync({ id: l.p.id, tituloId: l.t.id, valor_pago: Number(valor || l.aberto), data_pagamento: data, forma_pagamento: forma });
        toast.success('Parcela baixada');
      } else if (acao.tipo === 'reagendar') {
        await upd.mutateAsync({ id: l.p.id, tituloId: l.t.id, data_vencimento: data, ...(valor ? { valor: Number(valor) } : {}) } as any);
        await supabase.from('ar_historico' as any).insert({
          titulo_id: l.t.id, parcela_id: l.p.id, tipo: 'reagendamento',
          descricao: `Parcela ${l.p.numero} reagendada de ${dataBR(l.p.data_vencimento)} para ${dataBR(data)}${valor ? ` · valor ${brl(Number(valor))}` : ''}`,
        } as any);
        toast.success('Parcela reagendada');
      } else if (acao.tipo === 'anotar') {
        if (!texto.trim()) return;
        const { error } = await supabase.from('ar_historico' as any).insert({ titulo_id: l.t.id, parcela_id: l.p.id, tipo: 'anotacao', descricao: texto.trim() } as any);
        if (error) throw error;
        toast.success('Anotação registrada');
      } else {
        await stage.mutateAsync({ tituloId: l.t.id, stage: 'judicial', motivo: texto.trim() || 'Encaminhado para cobrança jurídica' });
        toast.success('Encaminhado para cobrança jurídica');
      }
      qc.invalidateQueries({ queryKey: ['ar-titulos'] });
      qc.invalidateQueries({ queryKey: ['ar-historico', l.t.id] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível salvar');
    }
  };

  const titulo = { baixa: 'Marcar como paga', reagendar: 'Reagendar parcela', anotar: 'Nova anotação', judicial: 'Encaminhar para jurídico' }[acao.tipo];
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {l.t.customer_name} · parcela {l.p.numero}/{l.total} · vence {dataBR(l.p.data_vencimento)} · em aberto {brl(l.aberto)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {(acao.tipo === 'baixa' || acao.tipo === 'reagendar') && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{acao.tipo === 'baixa' ? 'Data do pagamento' : 'Nova data'}</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
              <div><Label>{acao.tipo === 'baixa' ? 'Valor recebido' : 'Novo valor (opcional)'}</Label>
                <Input type="number" step="0.01" placeholder={String(acao.tipo === 'baixa' ? l.aberto : l.p.valor)} value={valor} onChange={(e) => setValor(e.target.value)} /></div>
            </div>
          )}
          {acao.tipo === 'baixa' && (
            <div><Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pix', 'boleto', 'cartao', 'transferencia', 'dinheiro', 'outro'].map((v) => <SelectItem key={v} value={v}>{v.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select></div>
          )}
          {(acao.tipo === 'anotar' || acao.tipo === 'judicial') && (
            <div><Label>{acao.tipo === 'anotar' ? 'Anotação' : 'Motivo (opcional)'}</Label>
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} /></div>
          )}
          {acao.tipo === 'judicial' && (
            <p className="text-sm text-muted-foreground">O título sai da agenda e das pendências e passa para a etapa "Cobrança judicial" da Esteira.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={pend || (acao.tipo === 'anotar' && !texto.trim())}>{pend ? 'Salvando…' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, valor, cls = '' }: { label: string; valor: string; cls?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className={`text-lg font-bold ${cls}`}>{valor}</CardContent>
    </Card>
  );
}

const Carregando = () => <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

/* ---------------- Agenda de cobranças ---------------- */
export function AgendaCobrancas({ filtros }: { filtros: FiltrosCobranca }) {
  const { isLoading, linhas, hoje, nomeUser } = useBase(filtros);
  const [modo, setModo] = useState<'semana' | 'mes'>('semana');
  const [ref, setRef] = useState(hoje);
  const [acao, setAcao] = useState<Acao>(null);

  const { inicio, fim } = useMemo(() => {
    if (modo === 'semana') { const i = inicioSemana(ref); return { inicio: i, fim: addDias(i, 6) }; }
    const i = `${mesDe(ref)}-01`;
    const d = new Date(i + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
    return { inicio: i, fim: d.toISOString().slice(0, 10) };
  }, [modo, ref]);

  const doPeriodo = useMemo(
    () => linhas
      .filter((l) => l.t.cobranca_stage !== 'judicial'
        && (l.t.status === 'aberto' || l.t.status === 'quitado')
        && (l.t.payment_method || '').toLowerCase() !== 'credit_card')
      .filter((l) => l.p.status !== 'cancelado' && l.p.data_vencimento >= inicio && l.p.data_vencimento <= fim)
      .sort((a, b) => a.p.data_vencimento.localeCompare(b.p.data_vencimento)),
    [linhas, inicio, fim],
  );
  const semanas = useMemo(() => totaisPorSemana(doPeriodo.map((l) => l.p), inicio, fim), [doPeriodo, inicio, fim]);
  const tot = semanas.reduce((s, w) => ({ previsto: s.previsto + w.previsto, recebido: s.recebido + w.recebido, aReceber: s.aReceber + w.aReceber }), { previsto: 0, recebido: 0, aReceber: 0 });
  const semanaAtual = inicioSemana(hoje);

  const navegar = (dir: number) => {
    if (modo === 'semana') setRef(addDias(inicioSemana(ref), 7 * dir));
    else { const d = new Date(`${mesDe(ref)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + dir); setRef(d.toISOString().slice(0, 10)); }
  };

  const grupos = (ls: Linha[]) => {
    const m = new Map<string, Linha[]>();
    ls.forEach((l) => { const k = l.t.cobranca_responsavel_id ?? 'none'; m.set(k, [...(m.get(k) ?? []), l]); });
    return Array.from(m.entries()).sort((a, b) => (nomeUser.get(a[0]) ?? 'zz').localeCompare(nomeUser.get(b[0]) ?? 'zz'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          {(['semana', 'mes'] as const).map((m) => (
            <Button key={m} size="sm" variant={modo === m ? 'default' : 'ghost'} onClick={() => setModo(m)}>{m === 'semana' ? 'Semana' : 'Mês'}</Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => navegar(-1)}>‹</Button>
        <Button size="sm" variant="outline" onClick={() => setRef(hoje)}>Hoje</Button>
        <Button size="sm" variant="outline" onClick={() => navegar(1)}>›</Button>
        <span className="text-sm font-medium">{modo === 'semana' ? `${dataBR(inicio)} a ${dataBR(fim)}` : mesLabel(mesDe(inicio))}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Previsto" valor={brl(tot.previsto)} />
        <Kpi label="Recebido" valor={brl(tot.recebido)} cls="text-emerald-600" />
        <Kpi label="A receber" valor={brl(tot.aReceber)} cls="text-amber-600" />
      </div>
      {isLoading ? <Carregando /> : semanas.map((w) => {
        const itens = doPeriodo.filter((l) => inicioSemana(l.p.data_vencimento) === w.inicio);
        return (
          <Card key={w.inicio} className={w.inicio === semanaAtual ? 'border-primary' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
                <span>Semana {dataBR(w.inicio)} a {dataBR(addDias(w.inicio, 6))}{w.inicio === semanaAtual && <Badge className="ml-2">Atual</Badge>}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Previsto {brl(w.previsto)} · Recebido <span className="text-emerald-600">{brl(w.recebido)}</span> · A receber <span className="text-amber-600">{brl(w.aReceber)}</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {itens.length === 0 ? <p className="text-xs text-muted-foreground">Sem cobranças nesta semana.</p> : grupos(itens).map(([cob, ls]) => (
                <div key={cob} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold border-b pb-1">
                    <span>{nomeUser.get(cob) ?? 'Sem cobrador'}</span>
                    <span>{brl(ls.reduce((s, l) => s + l.aberto, 0))} a receber</span>
                  </div>
                  {ls.map((l) => {
                    const atras = l.aberto > 0 && l.p.data_vencimento < hoje;
                    return (
                      <div key={l.p.id} className="flex flex-wrap items-center gap-2 text-sm py-1">
                        <span className="w-20 text-xs text-muted-foreground">{dataBR(l.p.data_vencimento)}</span>
                        <span className="font-medium flex-1 min-w-[160px]">{l.t.customer_name}</span>
                        <Badge variant="outline" className="text-[10px]">parcela {l.p.numero}/{l.total}</Badge>
                        <span className="w-24 text-right">{brl(l.p.valor)}</span>
                        {l.aberto === 0 ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Paga</Badge>
                          : atras ? <span className="text-xs font-semibold text-red-600">{diasEntre(l.p.data_vencimento, hoje)} dias de atraso</span>
                          : <span className="text-xs text-muted-foreground">Pendente</span>}
                        <ContatoRapido telefone={l.t.customer_phone} />
                        {l.aberto > 0 && <AcoesParcela l={l} onAcao={setAcao} judicial={false} />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
      <AcaoDialog key={acao?.l.p.id ?? 'none'} acao={acao} onClose={() => setAcao(null)} />
    </div>
  );
}

/* ---------------- Pendências (fonte única para mês e histórico) ---------------- */
function usePendencias(f: FiltrosCobranca) {
  const base = useBase(f);
  const pend = useMemo(
    () => base.linhas.filter((l) => !tituloForaCobranca(l.t) && isPendenciaMesAnterior(l.p, base.hoje)),
    [base.linhas, base.hoje],
  );
  return { ...base, pend };
}

function TabelaPendencias({ ls, hoje, gerentes, nomeUser, onAcao }: {
  ls: Linha[]; hoje: string; gerentes: any; nomeUser: Map<string, string>; onAcao: (a: Acao) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead><TableHead>Contato</TableHead><TableHead>Produto</TableHead>
          <TableHead>Cobrador</TableHead><TableHead>Gerente</TableHead><TableHead>Vencimento</TableHead>
          <TableHead className="text-right">Previsto</TableHead><TableHead className="text-right">Pago</TableHead>
          <TableHead className="text-right">Em aberto</TableHead><TableHead>Atraso</TableHead><TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {ls.map((l) => (
          <TableRow key={l.p.id}>
            <TableCell><div className="font-medium">{l.t.customer_name}</div><div className="text-xs text-muted-foreground">{ticketNumber(l.t.id)} · parcela {l.p.numero}/{l.total}</div></TableCell>
            <TableCell><ContatoRapido telefone={l.t.customer_phone} email={l.t.customer_email} /></TableCell>
            <TableCell className="text-xs">{l.t.product_code}</TableCell>
            <TableCell className="text-xs">{nomeUser.get(l.t.cobranca_responsavel_id ?? '') ?? '—'}</TableCell>
            <TableCell className="text-xs">{gerentes?.get(l.t.id)?.gerente_nome ?? '—'}</TableCell>
            <TableCell className="text-xs">{dataBR(l.p.data_vencimento)}</TableCell>
            <TableCell className="text-right">{brl(l.p.valor)}</TableCell>
            <TableCell className="text-right text-emerald-600">{brl(recebido(l.p))}</TableCell>
            <TableCell className="text-right"><SaldoValor valor={l.aberto} /></TableCell>
            <TableCell className="text-xs font-semibold text-red-600 whitespace-nowrap">{diasEntre(l.p.data_vencimento, hoje)} dias</TableCell>
            <TableCell><AcoesParcela l={l} onAcao={onAcao} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PendenciasMes({ filtros }: { filtros: FiltrosCobranca }) {
  const { isLoading, pend, hoje, gerentes, nomeUser } = usePendencias(filtros);
  const [acao, setAcao] = useState<Acao>(null);
  const meses = useMemo(() => {
    const m = new Map<string, { qtd: number; total: number }>();
    pend.forEach((l) => { const k = mesDe(l.p.data_vencimento); const c = m.get(k) ?? { qtd: 0, total: 0 }; c.qtd++; c.total += l.aberto; m.set(k, c); });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [pend]);
  const [mesSel, setMesSel] = useState<string | null>(null);
  const mes = mesSel && meses.some(([k]) => k === mesSel) ? mesSel : meses[0]?.[0];
  const ls = pend.filter((l) => mesDe(l.p.data_vencimento) === mes).sort((a, b) => b.aberto - a.aberto);
  const porCliente = new Map<string, number>();
  ls.forEach((l) => porCliente.set(l.t.id, (porCliente.get(l.t.id) ?? 0) + l.aberto));

  if (isLoading) return <Carregando />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {meses.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência de meses anteriores.</p>}
        {meses.map(([k, c]) => (
          <button key={k} onClick={() => setMesSel(k)}
            className={`rounded-full border px-3 py-1.5 text-xs ${k === mes ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-muted'}`}>
            <span className="font-semibold capitalize">{mesLabel(k)}</span> · {c.qtd} · {brl(c.total)}
          </button>
        ))}
      </div>
      {mes && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Clientes pendentes" valor={String(porCliente.size)} />
          <Kpi label="Total em aberto" valor={brl(ls.reduce((s, l) => s + l.aberto, 0))} cls="text-amber-600" />
          <Kpi label="Maior valor de um cliente" valor={brl(Math.max(0, ...porCliente.values()))} cls="text-red-600" />
          <Kpi label="Maior atraso" valor={`${Math.max(0, ...ls.map((l) => diasEntre(l.p.data_vencimento, hoje)))} dias`} cls="text-red-600" />
        </div>
      )}
      <Card><CardContent className="pt-4 overflow-x-auto">
        {ls.length === 0 ? <p className="text-center py-10 text-muted-foreground">Nenhuma pendência neste mês</p>
          : <TabelaPendencias ls={ls} hoje={hoje} gerentes={gerentes} nomeUser={nomeUser} onAcao={setAcao} />}
      </CardContent></Card>
      <AcaoDialog key={acao?.l.p.id ?? 'none'} acao={acao} onClose={() => setAcao(null)} />
    </div>
  );
}

export function InadimplenciaHistorica({ filtros }: { filtros: FiltrosCobranca }) {
  const { isLoading, pend, hoje, gerentes, nomeUser } = usePendencias(filtros);
  const [acao, setAcao] = useState<Acao>(null);
  const ls = useMemo(() => {
    const saldo = new Map<string, number>();
    pend.forEach((l) => saldo.set(l.t.id, (saldo.get(l.t.id) ?? 0) + l.aberto));
    return [...pend].sort((a, b) => (saldo.get(b.t.id)! - saldo.get(a.t.id)!) || a.p.data_vencimento.localeCompare(b.p.data_vencimento));
  }, [pend]);
  const clientes = new Set(ls.map((l) => l.t.id)).size;
  if (isLoading) return <Carregando />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Clientes inadimplentes" valor={String(clientes)} />
        <Kpi label="Parcelas em aberto" valor={String(ls.length)} />
        <Kpi label="Total em aberto" valor={brl(ls.reduce((s, l) => s + l.aberto, 0))} cls="text-red-600" />
      </div>
      <Card><CardContent className="pt-4 overflow-x-auto">
        {ls.length === 0 ? <p className="text-center py-10 text-muted-foreground">Nenhuma inadimplência de meses anteriores.</p>
          : <TabelaPendencias ls={ls} hoje={hoje} gerentes={gerentes} nomeUser={nomeUser} onAcao={setAcao} />}
      </CardContent></Card>
      <AcaoDialog key={acao?.l.p.id ?? 'none'} acao={acao} onClose={() => setAcao(null)} />
    </div>
  );
}

/* ---------------- Resultados por cobrador ---------------- */
export function ResultadosCobrador({ filtros }: { filtros: FiltrosCobranca }) {
  const { isLoading, linhas, hoje, nomeUser } = useBase(filtros);
  const [de, setDe] = useState(`${mesDe(hoje)}-01`);
  const [ate, setAte] = useState(hoje);
  const ranking = useMemo(() => {
    const m = new Map<string, { total: number; qtd: number }>();
    linhas.forEach((l) => {
      if (l.p.status !== 'pago' || !l.p.data_pagamento) return;
      const d = l.p.data_pagamento.slice(0, 10);
      if (d < de || d > ate) return;
      const k = l.t.cobranca_responsavel_id ?? 'none';
      const c = m.get(k) ?? { total: 0, qtd: 0 };
      c.total += recebido(l.p); c.qtd++; m.set(k, c);
    });
    return Array.from(m.entries()).map(([k, v]) => ({ nome: nomeUser.get(k) ?? 'Sem cobrador', ...v })).sort((a, b) => b.total - a.total);
  }, [linhas, de, ate, nomeUser]);
  const total = ranking.reduce((s, r) => s + r.total, 0);
  if (isLoading) return <Carregando />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <div className="text-sm">Total arrecadado: <span className="font-bold text-emerald-600">{brl(total)}</span></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ranking.slice(0, 8).map((r, i) => <Kpi key={r.nome} label={`${i + 1}º ${r.nome} · ${r.qtd} baixa(s)`} valor={brl(r.total)} cls="text-emerald-600" />)}
      </div>
      {ranking.length > 0 ? (
        <Card><CardContent className="pt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ranking}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      ) : <p className="text-center py-10 text-muted-foreground">Nenhum pagamento no período.</p>}
    </div>
  );
}
