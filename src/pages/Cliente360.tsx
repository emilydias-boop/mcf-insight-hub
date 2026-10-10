import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone, Mail, CalendarDays, Wallet, Package, Clock, AlertTriangle, Search, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = (d?: string | null, hora = false) =>
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', ...(hora ? {} : { hour: undefined, minute: undefined, second: undefined, day: '2-digit', month: '2-digit', year: 'numeric' }) }) : '—';

interface Titulo { id: string; product_code: string | null; product_name: string | null; sale_date: string | null; contratado: number; pago: number; n_parc: number; n_pagas: number; n_atras: number; prox: string | null; reembolsado: boolean; }
interface Cota { id: string; grupo: string | null; cota: string | null; valor_credito: number | null; status: string | null; data_contratacao: string | null; n_pagas: number; n_atras: number; prox: string | null; }
interface Dados360 {
  contato: { id: string; name: string; email: string | null; phone: string | null; created_at: string; tags: string[] | null };
  registros_unificados: number; primeiro_contato: string | null; primeira_compra: string | null;
  sdr: string | null; closer: string | null; pos_venda: { id: string; stage_name: string; gerente: string | null } | null;
  titulos: Titulo[]; cotas: Cota[]; creditos: { id: string; banco: string; modalidade: string; valor_credito: number; status: string; data_assinatura: string }[];
}
interface Evento { ts: string; tipo: string; bu: string; titulo: string; detalhe: string | null; ator: string | null; deal_id: string | null; }

const TIPOS: Record<string, string> = { lead: 'Lead', atividade: 'Atividade', etapa: 'Etapa', ligacao: 'Ligação', reuniao: 'Reunião', contrato: 'Contrato A000', venda: 'Compra', reembolso: 'Reembolso', consorcio: 'Consórcio', credito: 'Crédito' };

function Busca() {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const res = useQuery({
    queryKey: ['c360-busca', q], enabled: q.trim().length >= 3,
    queryFn: async () => {
      const t = q.trim().replace(/[,()]/g, ' ');
      const dig = t.replace(/\D/g, '');
      const ors = [`name.ilike.%${t}%`, `email.ilike.%${t}%`];
      if (dig.length >= 8) ors.push(`phone.ilike.%${dig.slice(-9)}%`);
      const { data, error } = await db.from('crm_contacts').select('id,name,email,phone').or(ors.join(',')).is('merged_into_contact_id', null).limit(20);
      if (error) throw error;
      return data as { id: string; name: string; email: string; phone: string }[];
    },
  });
  return (
    <div className="max-w-2xl mx-auto space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Visão 360 do Cliente</h1>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Nome, e-mail ou telefone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {res.data?.map((c) => (
        <button key={c.id} onClick={() => nav(`/clientes/${c.id}/360`)} className="w-full text-left rounded-lg border p-3 hover:bg-muted">
          <div className="font-medium">{c.name}</div><div className="text-sm text-muted-foreground">{c.email} · {c.phone}</div>
        </button>
      ))}
    </div>
  );
}

export default function Cliente360() {
  const { contactId: param } = useParams();
  const [sp] = useSearchParams();
  const email = sp.get('email');

  const resolvido = useQuery({
    queryKey: ['c360-email', email], enabled: !param && !!email,
    queryFn: async () => {
      const { data } = await db.from('crm_contacts').select('id').ilike('email', email).is('merged_into_contact_id', null).order('created_at').limit(1);
      return (data?.[0]?.id as string) ?? null;
    },
  });
  const contactId = param ?? resolvido.data ?? undefined;

  const dados = useQuery({
    queryKey: ['c360', contactId], enabled: !!contactId,
    queryFn: async () => { const { data, error } = await db.rpc('cliente_360', { _contact_id: contactId }); if (error) throw error; return data as Dados360; },
  });
  const linha = useQuery({
    queryKey: ['c360-tl', contactId], enabled: !!contactId,
    queryFn: async () => { const { data, error } = await db.rpc('cliente_timeline', { _contact_id: contactId }); if (error) throw error; return (data as Evento[]).filter((e) => e.ts).sort((a, b) => b.ts.localeCompare(a.ts)); },
  });

  if (!param && !email) return <Busca />;
  if (email && !param && resolvido.isSuccess && !resolvido.data) return <div className="p-8 text-muted-foreground">Nenhum contato do CRM encontrado com o e-mail {email}.</div>;
  if (dados.error) return <div className="p-8 text-destructive">{String((dados.error as { message?: string }).message ?? '').replace(/^sem_permissao:\s*/, '')}</div>;
  if (!dados.data) return <div className="p-6 space-y-4"><Skeleton className="h-24" /><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;

  return <Visao d={dados.data} eventos={linha.data ?? []} carregandoTl={linha.isLoading} />;
}

function Visao({ d, eventos, carregandoTl }: { d: Dados360; eventos: Evento[]; carregandoTl: boolean }) {
  const [fBu, setFBu] = useState('todas');
  const [fTipo, setFTipo] = useState('todos');
  const ativos = d.titulos.filter((t) => !t.reembolsado);
  const investido = ativos.reduce((s, t) => s + Number(t.contratado || 0), 0) + d.cotas.reduce((s, c) => s + Number(c.valor_credito || 0), 0);
  const codigos = new Set(ativos.map((t) => t.product_code).filter(Boolean));
  const totalParc = ativos.reduce((s, t) => s + t.n_pagas + t.n_atras, 0) + d.cotas.reduce((s, c) => s + c.n_pagas + c.n_atras, 0);
  const atrasadas = ativos.reduce((s, t) => s + t.n_atras, 0) + d.cotas.reduce((s, c) => s + c.n_atras, 0);
  const adimplencia = totalParc ? Math.round(((totalParc - atrasadas) / totalParc) * 100) : null;
  const inicio = d.primeira_compra ?? d.primeiro_contato;
  const meses = inicio ? Math.max(0, Math.floor((Date.now() - new Date(inicio).getTime()) / (30.44 * 86400000))) : null;
  const tempo = meses == null ? '—' : meses >= 12 ? `${Math.floor(meses / 12)} ano(s) e ${meses % 12} mês(es)` : `${meses} mês(es)`;

  const patrimonio = useMemo(() => {
    const ev = [
      ...ativos.filter((t) => t.sale_date).map((t) => ({ d: t.sale_date!, v: Number(t.contratado) })),
      ...d.cotas.filter((c) => c.data_contratacao).map((c) => ({ d: c.data_contratacao!, v: Number(c.valor_credito || 0) })),
    ].sort((a, b) => a.d.localeCompare(b.d));
    let acc = 0; const m = new Map<string, number>();
    ev.forEach((e) => { acc += e.v; m.set(e.d.slice(0, 7), acc); });
    return [...m.entries()].map(([mes, v]) => ({ mes, v }));
  }, [d]);

  const marcos = eventos.filter((e) => ['lead', 'contrato', 'venda', 'consorcio', 'credito'].includes(e.tipo) || (e.bu === 'Pós Venda')).slice().reverse();
  const marcosResumo = [marcos.find((e) => e.tipo === 'lead'), ...marcos.filter((e) => e.tipo !== 'lead')].filter(Boolean).slice(0, 8) as Evento[];
  const bus = [...new Set(eventos.map((e) => e.bu))];
  const filtrados = eventos.filter((e) => (fBu === 'todas' || e.bu === fBu) && (fTipo === 'todos' || e.tipo === fTipo));
  const iniciais = d.contato.name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  const kpis = [
    { i: Wallet, t: 'Valor total investido', v: brl(investido), s: 'Produtos sem reembolso + crédito de cotas' },
    { i: Package, t: 'Produtos ativos', v: String(codigos.size + d.cotas.length + d.creditos.length), s: `${d.titulos.length} título(s) no contas a receber` },
    { i: Clock, t: 'Tempo de relacionamento', v: tempo, s: inicio ? `Desde ${dt(inicio)}` : 'Sem compra registrada' },
    { i: AlertTriangle, t: 'Pendências financeiras', v: String(atrasadas), s: atrasadas ? 'Parcela(s) vencida(s)' : 'Nada vencido', warn: atrasadas > 0 },
    { i: CalendarDays, t: 'Adimplência geral', v: adimplencia == null ? '—' : `${adimplencia}%`, s: `${totalParc} parcela(s) vencidas ou pagas` },
  ];

  return (
    <div className="space-y-5">
      <Link to="/clientes/360" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Buscar outro cliente</Link>
      <div className="flex flex-wrap items-start gap-4">
        <div className="h-20 w-20 rounded-full border-2 border-primary flex items-center justify-center text-2xl font-semibold text-primary">{iniciais}</div>
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap"><h1 className="text-3xl font-semibold">{d.contato.name}</h1>
            {d.pos_venda && <Badge>Pós Venda · {d.pos_venda.stage_name}</Badge>}</div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {d.contato.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{d.contato.phone}</span>}
            {d.contato.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{d.contato.email}</span>}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">Primeiro contato: {dt(d.primeiro_contato)}</Badge>
            <Badge variant="outline">SDR: {d.sdr ?? '—'}</Badge>
            <Badge variant="outline">Closer: {d.closer ?? '—'}</Badge>
            <Badge variant="outline">Gerente de Relacionamento: {d.pos_venda?.gerente ?? '—'}</Badge>
            {d.registros_unificados > 1 && <Badge variant="secondary">{d.registros_unificados} cadastros unificados</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <Card key={k.t}><CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><k.i className={`h-4 w-4 ${k.warn ? 'text-destructive' : 'text-primary'}`} />{k.t}</div>
            <div className={`text-2xl font-semibold ${k.warn ? 'text-destructive' : 'text-primary'}`}>{k.v}</div>
            <div className="text-xs text-muted-foreground">{k.s}</div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="visao">
        <TabsList><TabsTrigger value="visao">Visão 360°</TabsTrigger><TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList>

        <TabsContent value="visao" className="grid lg:grid-cols-3 gap-4 mt-4">
          <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-base">Linha do Tempo do Cliente</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {marcosResumo.length === 0 ? <p className="text-sm text-muted-foreground">Sem marcos registrados.</p> : (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {marcosResumo.map((e, i) => (
                    <div key={i} className="min-w-[130px] text-center space-y-1">
                      <div className="mx-auto h-3 w-3 rounded-full bg-primary" />
                      <div className="text-xs font-medium">{e.titulo}</div>
                      <div className="text-xs text-muted-foreground">{dt(e.ts)}</div>
                      <div className="text-[11px] text-muted-foreground">{e.bu}</div>
                    </div>))}
                </div>)}
              <div><div className="text-sm font-medium mb-2">Evolução do Patrimônio Investido</div>
                {patrimonio.length ? (
                  <div className="h-52"><ResponsiveContainer><AreaChart data={patrimonio}>
                    <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: number) => brl(v)} />
                    <Area dataKey="v" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                  </AreaChart></ResponsiveContainer></div>) : <p className="text-sm text-muted-foreground">Sem valores registrados.</p>}
              </div>
            </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Últimas Interações</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {eventos.filter((e) => ['atividade', 'ligacao', 'reuniao'].includes(e.tipo) || e.bu === 'Pós Venda').slice(0, 6).map((e, i) => (
                <div key={i} className="border-l-2 border-primary pl-3">
                  <div className="text-xs text-muted-foreground">{dt(e.ts, true)} · {e.bu}</div>
                  <div className="text-sm font-medium">{e.titulo}</div>
                  {e.detalhe && <div className="text-xs text-muted-foreground line-clamp-2">{e.detalhe}</div>}
                  {e.ator && <div className="text-xs text-primary">Responsável: {e.ator}</div>}
                </div>))}
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="produtos" className="mt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {d.titulos.map((t) => (
            <Card key={t.id}><CardContent className="p-4 space-y-1">
              <div className="flex justify-between gap-2"><span className="font-medium">{t.product_name ?? t.product_code}</span>
                <Badge variant={t.reembolsado || t.n_atras ? 'destructive' : 'secondary'}>{t.reembolsado ? 'Reembolsado' : t.n_atras ? 'Atrasado' : t.n_parc > t.n_pagas ? 'Parcelado' : 'Quitado'}</Badge></div>
              <div className="text-xl font-semibold text-primary">{brl(t.contratado)}</div>
              <div className="text-xs text-muted-foreground">{t.n_pagas}/{t.n_parc} parcelas pagas · compra {dt(t.sale_date)}</div>
              {t.prox && <div className="text-xs">Próx. parcela: {dt(t.prox)}</div>}
            </CardContent></Card>))}
          {d.cotas.map((c) => (
            <Card key={c.id}><CardContent className="p-4 space-y-1">
              <div className="flex justify-between gap-2"><span className="font-medium">Consórcio · grupo {c.grupo} cota {c.cota}</span>
                <Badge variant={c.n_atras ? 'destructive' : 'secondary'}>{c.n_atras ? 'Atrasado' : (c.status ?? 'Ativo')}</Badge></div>
              <div className="text-xl font-semibold text-primary">{brl(Number(c.valor_credito || 0))}</div>
              <div className="text-xs text-muted-foreground">{c.n_pagas} parcelas pagas · contratada {dt(c.data_contratacao)}</div>
              {c.prox && <div className="text-xs">Próx. venc.: {dt(c.prox)}</div>}
            </CardContent></Card>))}
          {d.creditos.map((c) => (
            <Card key={c.id}><CardContent className="p-4 space-y-1">
              <div className="flex justify-between"><span className="font-medium">Crédito · {c.banco ?? '—'}</span><Badge variant="secondary">{c.status}</Badge></div>
              <div className="text-xl font-semibold text-primary">{brl(Number(c.valor_credito || 0))}</div>
              <div className="text-xs text-muted-foreground">{c.modalidade} · assinatura {dt(c.data_assinatura)}</div>
            </CardContent></Card>))}
          {!d.titulos.length && !d.cotas.length && !d.creditos.length && <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4">
          <Card><CardContent className="p-4 overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-muted-foreground text-left"><tr><th className="py-2">Produto</th><th>Contratado</th><th>Recebido</th><th>Pagas</th><th>Atrasadas</th><th>Próx. vencimento</th></tr></thead>
            <tbody>{d.titulos.map((t) => (<tr key={t.id} className="border-t"><td className="py-2">{t.product_name ?? t.product_code}</td><td>{brl(t.contratado)}</td><td>{brl(Math.min(t.pago, t.contratado || t.pago))}</td><td>{t.n_pagas}/{t.n_parc}</td><td className={t.n_atras ? 'text-destructive' : ''}>{t.n_atras}</td><td>{dt(t.prox)}</td></tr>))}
              {d.cotas.map((c) => (<tr key={c.id} className="border-t"><td className="py-2">Consórcio {c.grupo}/{c.cota}</td><td>{brl(Number(c.valor_credito || 0))}</td><td>—</td><td>{c.n_pagas}</td><td className={c.n_atras ? 'text-destructive' : ''}>{c.n_atras}</td><td>{dt(c.prox)}</td></tr>))}</tbody>
          </table></CardContent></Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={fBu} onValueChange={setFBu}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas as áreas</SelectItem>{bus.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
            <Select value={fTipo} onValueChange={setFTipo}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos os eventos</SelectItem>{Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
            <span className="text-sm text-muted-foreground self-center">{filtrados.length} evento(s)</span>
          </div>
          {carregandoTl ? <Skeleton className="h-64" /> : (
            <Card><CardContent className="p-4 space-y-3">
              {filtrados.map((e, i) => (
                <div key={i} className="flex gap-3 border-b last:border-0 pb-3">
                  <div className="w-36 shrink-0 text-xs text-muted-foreground">{dt(e.ts, true)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 items-center flex-wrap"><Badge variant="outline">{e.bu}</Badge><span className="text-sm font-medium">{e.titulo}</span></div>
                    {e.detalhe && <div className="text-xs text-muted-foreground mt-1 break-words">{e.detalhe}</div>}
                    {e.ator && <div className="text-xs text-primary mt-1">{e.ator}</div>}
                  </div>
                  {e.deal_id && <Button asChild size="sm" variant="ghost"><Link to={`/crm/negocios?deal=${e.deal_id}`}>Abrir card</Link></Button>}
                </div>))}
              {!filtrados.length && <p className="text-sm text-muted-foreground">Nenhum evento.</p>}
            </CardContent></Card>)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
