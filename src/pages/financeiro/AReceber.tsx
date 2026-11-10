import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Wallet, AlertCircle, CheckCircle2, Clock, List, KanbanSquare, Scale, CheckCheck, Undo2, FilePlus2, Users } from 'lucide-react';
import { useArTitulos, useFinanceiroUsers, useUpdateArTitulo, useBaixarTitulosLote } from '@/hooks/useAReceber';
import { useCanManageAr } from '@/hooks/useArGestores';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format as fmtDate } from 'date-fns';
import {
  AR_TITULO_STATUS_LABEL,
  AR_TITULO_TIPO_LABEL,
  type ArTituloStatus,
  type ArTitulo,
  type ArCobrancaStage,
} from '@/types/aReceber';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ArGestoresDialog } from '@/components/financeiro/ArGestoresDialog';
import { KanbanCobranca, CobrancaStageBadge } from '@/components/financeiro/aReceber/KanbanCobranca';
import {
  CobrancaResponsavelDialog,
  CobrancaResponsavelInfo,
  CobrancaResponsavelFilter,
} from '@/components/financeiro/aReceber/CobrancaResponsavelDialog';
import { useGerentesConta, GerenteContaInfo, GerenteContaFilter } from '@/components/financeiro/aReceber/GerenteConta';
import { ReconciliacaoPanel } from '@/components/financeiro/aReceber/ReconciliacaoPanel';
import { ReembolsosPanel } from '@/components/financeiro/aReceber/ReembolsosPanel';
import { DuplicidadePanel } from '@/components/financeiro/aReceber/DuplicidadePanel';
import { CadastroManualDialog } from '@/components/financeiro/aReceber/CadastroManualDialog';
import { useReembolsoTotais } from '@/hooks/useArReembolsos';
import { ticketNumber } from '@/lib/arTicketNumber';
import {
  AgendaCobrancas, PendenciasMes, InadimplenciaHistorica, ResultadosCobrador, FiltrosGlobais,
  FILTROS_VAZIOS, SaldoValor, StatusClienteBadge, type FiltrosCobranca,
} from '@/components/financeiro/aReceber/GestaoCobranca';
import { CobrancaJuridica, RelatoriosNotas, useReembolsosProximos } from '@/components/financeiro/aReceber/AReceberExtras';
import { saldoDevedor, statusListagem, telefoneDigitos } from '@/lib/arCobrancaCalc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SlidersHorizontal, MoreHorizontal, Phone, MessageCircle } from 'lucide-react';
import { Gavel, NotebookPen } from 'lucide-react';
import { ClientePainelLateral } from '@/components/financeiro/aReceber/ClientePainelLateral';
import { CalendarDays, AlarmClock, History, Trophy, Download } from 'lucide-react';

const TAB_CLS_OLD = 'flex flex-col items-center justify-center gap-1.5 h-auto min-w-[110px] px-6 py-3 rounded-xl border border-border bg-card text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:shadow-[0_0_0_1px_hsl(var(--primary))] transition-all';

const TAB_CLS = 'rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';
const TH = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap h-9';
const ABAS: [string, string][] = [
  ['listagem', 'Cobranças Regulares'], ['agenda', 'Agenda de Cobranças'], ['pendencias', 'Pendências por Mês'],
  ['inadimplencia', 'Inadimplência Histórica'], ['juridica', 'Cobrança Jurídica'], ['resultados', 'Resultados por Cobrador'],
  ['kanban', 'Esteira Cobrança'], ['reconciliacao', 'Reconciliação'], ['relatorios', 'Relatórios e Notas'],
];

function KpiBox({ label, valor, tom }: { label: string; valor: string; tom?: string }) {
  return (
    <Card className="px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${tom ?? 'text-foreground'}`}>{valor}</div>
    </Card>
  );
}

function TelefoneCell({ telefone }: { telefone?: string | null }) {
  const d = telefoneDigitos(telefone);
  if (!d) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <span className="text-xs tabular-nums">{telefone}</span>
      <a href={`tel:+${d}`} title="Ligar" className="p-1 rounded text-emerald-600 hover:bg-muted"><Phone className="w-3.5 h-3.5" /></a>
      <a href={`https://wa.me/${d}`} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1 rounded text-emerald-600 hover:bg-muted"><MessageCircle className="w-3.5 h-3.5" /></a>
    </div>
  );
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const PRODUCT_OPTIONS = [
  { value: 'todos', label: 'Todos os produtos' },
  { value: 'A001', label: 'A001 - Incorporador Completo' },
  { value: 'A002', label: 'A002 - Incorporador Básico' },
  { value: 'A003', label: 'A003 - Anticrise Completo' },
  { value: 'A004', label: 'A004 - Anticrise Básico' },
  { value: 'A009', label: 'A009 - Incorporador + The Club' },
  { value: 'R001', label: 'R001 - Incorporador Completo (Recorrência)' },
  { value: 'R009', label: 'R009 - Incorporador + The Club (Recorrência)' },
];

function StatusBadge({ status }: { status: ArTituloStatus }) {
  const cfg: Record<ArTituloStatus, { className: string; icon: any }> = {
    aberto: { className: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: Clock },
    quitado: { className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
    cancelado: { className: 'bg-muted text-muted-foreground', icon: AlertCircle },
    reembolsado: { className: 'bg-rose-500/15 text-rose-600 border-rose-500/30', icon: Undo2 },
  };
  const c = cfg[status];
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={c.className}>
      <Icon className="w-3 h-3 mr-1" />
      {AR_TITULO_STATUS_LABEL[status]}
    </Badge>
  );
}

function TipoBadge({ tipo }: { tipo: ArTitulo['tipo'] }) {
  const map: Record<ArTitulo['tipo'], string> = {
    integral: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    parcelado: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
    pendente_lancamento: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  };
  return (
    <Badge variant="outline" className={map[tipo]}>
      {AR_TITULO_TIPO_LABEL[tipo]}
    </Badge>
  );
}

export default function AReceber() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const { data: gerentesConta } = useGerentesConta();
  const { canManage } = useCanManageAr();
  const [status, setStatus] = useState<string>('aberto');
  const [tipo, setTipo] = useState<string>('todos');
  const [numeroTitulo, setNumeroTitulo] = useState<string>('');
  const [cobrancaStage, setCobrancaStage] = useState<string>('todos');
  const [cobrancaTitulo, setCobrancaTitulo] = useState<ArTitulo | null>(null);
  const [filtrosGestao, setFiltrosGestao] = useState<FiltrosCobranca>(FILTROS_VAZIOS);
  const [aba, setAba] = useState('listagem');
  const search = filtrosGestao.busca;
  const product = filtrosGestao.produto;
  const cobrancaResp = filtrosGestao.cobrador;
  const gerenteFiltro = filtrosGestao.gerente;

  const { data: titulos, isLoading } = useArTitulos({
    search: search || undefined,
    status: (status as any) === 'todos' ? undefined : (status as ArTituloStatus),
    tipo: tipo === 'todos' ? undefined : tipo,
    product_code: product === 'todos' ? undefined : product,
    cobranca_stage: cobrancaStage === 'todos' ? undefined : (cobrancaStage as ArCobrancaStage),
    cobranca_responsavel_id: cobrancaResp === 'todos' || cobrancaResp === 'none' ? undefined : cobrancaResp,
    excluir_judicial: true,
  });
  const reembolsosProximos = useReembolsosProximos();

  const { data: users } = useFinanceiroUsers();
  const updateTitulo = useUpdateArTitulo();
  const baixarLote = useBaixarTitulosLote();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openBaixaLote, setOpenBaixaLote] = useState(false);
  const [baixaData, setBaixaData] = useState(fmtDate(new Date(), 'yyyy-MM-dd'));
  const [baixaForma, setBaixaForma] = useState('pix');
  const [openReembolsos, setOpenReembolsos] = useState(false);
  const [openCadastroManual, setOpenCadastroManual] = useState(false);
  const [openDuplicidade, setOpenDuplicidade] = useState(false);
  const { data: reembTotais } = useReembolsoTotais();
  const [painelTitulo, setPainelTitulo] = useState<ArTitulo | null>(null);
  const maisFiltrosAtivos = [status !== 'aberto', tipo !== 'todos', cobrancaStage !== 'todos', !!numeroTitulo.trim()].filter(Boolean).length;
  const produtosGestao = PRODUCT_OPTIONS.filter(o => o.value !== 'todos').map(o => o.value);

  const exportarCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Nº', 'Cliente', 'E-mail', 'Telefone', 'Documento', 'Produto', 'Tipo', 'Forma pagamento', 'Data venda', 'Valor total', 'Entrada', 'Pago via cobranças', 'Saldo', 'Parcelas', 'Próxima cobrança', 'Dias de atraso', 'Status', 'Negociação', 'Cobrador', 'Gerente de contas'];
    const rows = titulosFiltrados.map(t => [
      ticketNumber(t.id), t.customer_name, t.customer_email, t.customer_phone, t.customer_document, t.product_code,
      AR_TITULO_TIPO_LABEL[t.tipo], t.payment_method, t.sale_date ? fmtDate(new Date(t.sale_date), 'dd/MM/yyyy') : '',
      Number(t.valor_total || 0).toFixed(2).replace('.', ','), Number(t.valor_entrada || 0).toFixed(2).replace('.', ','), Math.max((t.valor_pago || 0) - (t.valor_entrada || 0), 0).toFixed(2).replace('.', ','),
      Number(t.valor_pendente || 0).toFixed(2).replace('.', ','), `${t.parcelas_pagas ?? 0}/${t.parcelas_total ?? 0}`,
      t.proxima_parcela ? t.proxima_parcela.split('-').reverse().join('/') : '', t.dias_atraso || '', AR_TITULO_STATUS_LABEL[t.status], t.negociacao ? 'Sim' : '',
      (users ?? []).find(u => u.id === t.cobranca_responsavel_id)?.full_name ?? '', gerentesConta?.get(t.id)?.gerente_nome ?? '',
    ]);
    const csv = '\uFEFF' + [head, ...rows].map(r => r.map(esc).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `a-receber-${fmtDate(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = (ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const titulosFiltrados = useMemo(() => {
    let list = titulos ?? [];
    if (gerenteFiltro !== 'todos') {
      list = list.filter(t => {
        const g = gerentesConta?.get(t.id)?.gerente_nome;
        return gerenteFiltro === 'none' ? !g : g === gerenteFiltro;
      });
    }
    if (cobrancaResp === 'none') list = list.filter(t => !t.cobranca_responsavel_id);
    if (filtrosGestao.status !== 'todos') list = list.filter(t => statusListagem(t) === filtrosGestao.status);
    const q = numeroTitulo.trim().toLowerCase();
    if (!q) return list;
    return list.filter(t => {
      const num = ticketNumber(t.id).toLowerCase();
      // aceita "761226" ou "761226-2" (prefixo do documento da parcela)
      return num.includes(q) || q.startsWith(num);
    });
  }, [titulos, numeroTitulo, gerenteFiltro, gerentesConta, cobrancaResp, filtrosGestao.status]);

  const kpis = useMemo(() => {
    const list = titulosFiltrados;
    const totalContratado = list.reduce((s, t) => s + Number(t.valor_total || 0), 0);
    const totalRecebido = list.reduce((s, t) => s + (t.valor_pago || 0), 0);
    const saldo = list.reduce((s, t) => s + (t.valor_pendente || 0), 0);
    const pendentesLancamento = list.filter(t => t.tipo === 'parcelado' && (t.parcelas_total ?? 0) === 0).length;
    const pagoCobrancas = list.reduce((s, t) => s + Math.max((t.valor_pago || 0) - (t.valor_entrada || 0), 0), 0);
    const saldoDev = list.reduce((s, t) => s + (t.status === 'aberto' ? saldoDevedor(Number(t.valor_total), t.valor_entrada || 0, Math.max((t.valor_pago || 0) - (t.valor_entrada || 0), 0)) : 0), 0);
    const vencidos = list.filter(t => t.status === 'aberto' && (t.dias_atraso ?? 0) > 0).length;
    const clientes = new Set(list.map(t => (t.customer_email || t.customer_name || t.id).toLowerCase())).size;
    return { totalContratado, totalRecebido, saldo, pendentesLancamento, qtd: list.length, pagoCobrancas, saldoDev, vencidos, clientes };
  }, [titulosFiltrados]);

  const handleAssign = async (tituloId: string, userId: string) => {
    try {
      await updateTitulo.mutateAsync({ id: tituloId, responsavel_id: userId === 'none' ? null : userId });
      toast.success('Responsável atualizado');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar responsável');
    }
  };

  const handleChangeTipo = async (tituloId: string, novoTipo: ArTitulo['tipo']) => {
    try {
      await updateTitulo.mutateAsync({ id: tituloId, tipo: novoTipo });
      toast.success('Tipo atualizado');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar tipo');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Tabs value={aba} onValueChange={setAba} className="w-full">
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 bg-background/95 backdrop-blur border-b border-border space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="flex items-center gap-2 text-lg font-bold text-foreground whitespace-nowrap">
            <Wallet className="w-5 h-5 text-primary" /> Contas a Receber
          </h1>
          <div className="flex-1 min-w-[280px]">
            <FiltrosGlobais
              barra
              value={filtrosGestao}
              onChange={setFiltrosGestao}
              produtos={produtosGestao}
              extra={
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10">
                      <SlidersHorizontal className="w-4 h-4 mr-1" /> Mais filtros
                      {maisFiltrosAtivos > 0 && <Badge className="ml-1 h-5 px-1.5">{maisFiltrosAtivos}</Badge>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 space-y-3">
                    <p className="text-xs text-muted-foreground">Valem para Cobranças Regulares.</p>
                    <div className="space-y-1"><Label className="text-xs">Situação do título</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todas</SelectItem>
                          <SelectItem value="aberto">Em aberto</SelectItem>
                          <SelectItem value="quitado">Quitado</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select></div>
                    <div className="space-y-1"><Label className="text-xs">Tipo</Label>
                      <Select value={tipo} onValueChange={setTipo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os tipos</SelectItem>
                          <SelectItem value="integral">Integral</SelectItem>
                          <SelectItem value="parcelado">Parcelado</SelectItem>
                        </SelectContent>
                      </Select></div>
                    <div className="space-y-1"><Label className="text-xs">Stage cobrança</Label>
                      <Select value={cobrancaStage} onValueChange={setCobrancaStage}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os stages</SelectItem>
                          <SelectItem value="mes">Cobrança do mês</SelectItem>
                          <SelectItem value="atraso">Cobrança em atraso</SelectItem>
                        </SelectContent>
                      </Select></div>
                    <div className="space-y-1"><Label className="text-xs">Nº do título</Label>
                      <Input placeholder="ex.: 761226 ou 761226-2" value={numeroTitulo} onChange={(e) => setNumeroTitulo(e.target.value)} /></div>
                  </PopoverContent>
                </Popover>
              }
            />
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 flex-wrap">
          <TabsList className="h-auto bg-transparent p-0 gap-0 flex-wrap justify-start rounded-none">
            {ABAS.map(([v, l]) => (
              <TabsTrigger key={v} value={v} className={TAB_CLS}>{l}</TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-1 pb-1 flex-wrap">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setOpenReembolsos(true)}>
              <Undo2 className="w-4 h-4 mr-1" /> Reembolsos
              {reembolsosProximos.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{reembolsosProximos.length} perto do prazo</Badge>}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpenCadastroManual(true)}>
              <FilePlus2 className="w-4 h-4 mr-1" /> Cadastro Manual
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpenDuplicidade(true)}>
              <Users className="w-4 h-4 mr-1" /> Duplicidade
            </Button>
            {isAdmin && <ArGestoresDialog />}
          </div>
        </div>
      </div>
        <TabsContent value="listagem" className="space-y-4 sm:space-y-6 mt-4">
      {reembolsosProximos.length > 0 && (
        <button type="button" onClick={() => setOpenReembolsos(true)}
          className="w-full text-left text-sm rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2">
          {reembolsosProximos.length} reembolso(s) a pagar vencem em até 7 dias (prazo limite ou data prevista). Clique para ver.
        </button>
      )}
      <div>
        <h2 className="text-xl font-bold text-foreground">Cobranças Regulares</h2>
        <p className="text-sm text-muted-foreground">Clique na linha para detalhes · clique duplo para abrir a ficha completa</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox label="Clientes" valor={String(kpis.clientes)} />
        <KpiBox label="Saldo devedor total" valor={brl(kpis.saldoDev)} />
        <KpiBox label="Pago via cobranças" valor={brl(kpis.pagoCobrancas)} tom="text-emerald-600" />
        <KpiBox label="Com cobrança vencida" valor={String(kpis.vencidos)} tom="text-destructive" />
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
        <div className="flex gap-4 flex-wrap">
          <span>Valor contratado: <b className="text-foreground">{brl(kpis.totalContratado)}</b></span>
          <span>Recebido: <b className="text-foreground">{brl(kpis.totalRecebido)}</b></span>
          <span>Parcelados aguardando lançamento: <b className="text-foreground">{kpis.pendentesLancamento}</b></span>
          <button type="button" className="hover:underline" onClick={() => setOpenReembolsos(true)}>
            Reembolsos a pagar: <b className="text-destructive">{brl(reembTotais?.somaPendentes || 0)}</b> ({reembTotais?.qtdPendentes ?? 0})
          </button>
          <button type="button" className="hover:underline" onClick={() => setOpenReembolsos(true)}>
            Reembolsos pagos no mês: <b className="text-emerald-600">{brl(reembTotais?.somaPagos || 0)}</b>
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={exportarCsv} disabled={titulosFiltrados.length === 0}>
          <Download className="w-4 h-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {(titulos?.length ?? 0) >= 500 && (
        <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          Exibindo os 500 títulos mais recentes. Refine os filtros (status, produto, busca ou nº do título) para localizar registros específicos.
        </div>
      )}

      {/* Tabela */}
      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : titulosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Nenhum título encontrado com os filtros atuais.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    {(() => {
                      const openIds = titulosFiltrados.filter(t => t.status === 'aberto').map(t => t.id);
                      const allChecked = openIds.length > 0 && openIds.every(id => selected.has(id));
                      const someChecked = openIds.some(id => selected.has(id));
                      return (
                        <Checkbox
                          checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                          onCheckedChange={(v) => toggleAllVisible(openIds, !!v)}
                          aria-label="Selecionar todos"
                          disabled={openIds.length === 0}
                        />
                      );
                    })()}
                  </TableHead>
                  {['Cliente','Telefone','E-mail','Status','Produto','Gerente','Cobrador'].map(h => <TableHead key={h} className={TH}>{h}</TableHead>)}
                  {['Valor ofertado'].map(h => <TableHead key={h} className={`${TH} text-right`}>{h}</TableHead>)}
                  <TableHead className={TH}>Forma</TableHead>
                  {['Entrada','Pago','Saldo devedor'].map(h => <TableHead key={h} className={`${TH} text-right`}>{h}</TableHead>)}
                  <TableHead className={TH}>Próxima cobrança</TableHead>
                  <TableHead className={TH}>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titulosFiltrados.map(t => {
                  const precisaLancar = t.tipo === 'parcelado' && (t.parcelas_total ?? 0) === 0;
                  const isOpen = t.status === 'aberto';
                  const isSel = selected.has(t.id);
                  return (
                    <TableRow
                      key={t.id}
                      className={`text-xs ${precisaLancar ? 'bg-orange-500/5 ' : ''}${isSel ? 'bg-lime-500/10 ' : ''}cursor-pointer hover:bg-muted/40`}
                      onClick={() => setPainelTitulo(t)}
                      onDoubleClick={() => navigate(`/financeiro/a-receber/${t.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleSelected(t.id)}
                          disabled={!isOpen}
                          aria-label={`Selecionar título ${ticketNumber(t.id)}`}
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium whitespace-nowrap">{t.customer_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                          {ticketNumber(t.id)} · {precisaLancar ? <span className="text-orange-600 font-medium">Lançar parcelas</span> : `${t.parcelas_pagas}/${t.parcelas_total} parcelas`}
                        </div>
                      </TableCell>
                      <TableCell className="py-2"><TelefoneCell telefone={t.customer_phone} /></TableCell>
                      <TableCell className="py-2 text-xs" onClick={(e) => e.stopPropagation()}>
                        {t.customer_email ? <a href={`mailto:${t.customer_email}`} className="text-primary hover:underline whitespace-nowrap">{t.customer_email}</a> : '—'}
                      </TableCell>
                      <TableCell className="py-2"><StatusClienteBadge status={statusListagem(t)} /></TableCell>
                      <TableCell className="py-2 text-xs">
                        <div className="whitespace-nowrap">{t.product_name || t.product_code}</div>
                        <div className="text-[11px] text-muted-foreground">{t.product_code}</div>
                      </TableCell>
                      <TableCell className="py-2 text-xs whitespace-nowrap">{gerentesConta?.get(t.id)?.gerente_nome ?? '—'}</TableCell>
                      <TableCell className="py-2 text-xs whitespace-nowrap">{(users ?? []).find(u => u.id === t.cobranca_responsavel_id)?.full_name ?? '—'}</TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums whitespace-nowrap">{brl(Number(t.valor_total))}</TableCell>
                      <TableCell className="py-2 text-xs whitespace-nowrap">{t.payment_method || '—'}</TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums whitespace-nowrap">{brl(t.valor_entrada || 0)}</TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums whitespace-nowrap">{brl(Math.max((t.valor_pago || 0) - (t.valor_entrada || 0), 0))}</TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums whitespace-nowrap">
                        {(() => {
                          const sd = t.status === 'aberto' ? saldoDevedor(Number(t.valor_total), t.valor_entrada || 0, Math.max((t.valor_pago || 0) - (t.valor_entrada || 0), 0)) : 0;
                          return (t.dias_atraso ?? 0) > 0 && t.status === 'aberto' ? <span className="font-bold text-destructive">{brl(sd)}</span> : <SaldoValor valor={sd} />;
                        })()}
                      </TableCell>
                      <TableCell className="py-2 text-xs whitespace-nowrap tabular-nums">
                        {t.status === 'aberto' && t.proxima_parcela ? (
                          <span className={(t.dias_atraso ?? 0) > 0 ? 'font-semibold text-destructive' : ''}>{t.proxima_parcela.split('-').reverse().join('/')}</span>
                        ) : '—'}
                        {t.status === 'aberto' && (t.dias_atraso ?? 0) > 0 && (
                          <span className="ml-2 text-[11px] font-semibold text-destructive">{t.dias_atraso} dias de atraso</span>
                        )}
                        {t.status === 'aberto' && t.stage_effective && <div className="mt-0.5"><CobrancaStageBadge stage={t.stage_effective} /></div>}
                      </TableCell>
                      <TableCell className="py-2" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ações"><MoreHorizontal className="w-4 h-4" /></Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-64 space-y-3">
                            <div className="space-y-1">
                              <CobrancaResponsavelInfo titulo={t} compact />
                              <GerenteContaInfo gerente={gerentesConta?.get(t.id)} compact />
                            </div>
                            <Button size="sm" variant="outline" className="w-full" onClick={() => setCobrancaTitulo(t)}>Definir cobrança</Button>
                            <div className="space-y-1"><Label className="text-xs">Tipo</Label>
                              {canManage ? (
                                <Select value={t.tipo} onValueChange={(v) => handleChangeTipo(t.id, v as ArTitulo['tipo'])}>
                                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="integral">Integral</SelectItem>
                                    <SelectItem value="parcelado">Parcelado</SelectItem>
                                    <SelectItem value="pendente_lancamento">Pendente de lançamento</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : <div><TipoBadge tipo={t.tipo} /></div>}
                            </div>
                            <div className="space-y-1"><Label className="text-xs">Responsável</Label>
                              <Select value={t.responsavel_id ?? 'none'} onValueChange={(v) => handleAssign(t.id, v)}>
                                <SelectTrigger className="h-8"><SelectValue placeholder="Definir…" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— Sem responsável —</SelectItem>
                                  {(users ?? []).map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="text-[11px] text-muted-foreground">Venda: {t.sale_date ? format(new Date(t.sale_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'} · {AR_TITULO_STATUS_LABEL[t.status]}</div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected.size > 0 && (() => {
        const selList = titulosFiltrados.filter(t => selected.has(t.id));
        const totalSaldo = selList.reduce((s, t) => s + Number(t.valor_pendente ?? t.valor_total ?? 0), 0);
        return (
          <div className="sticky bottom-4 z-30 mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-lime-500/40 bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
              <div className="text-sm">
                <span className="font-semibold">{selected.size}</span> título(s) selecionado(s)
                {' · '}
                <span className="text-muted-foreground">Saldo:</span>{' '}
                <span className="font-semibold text-amber-600">{brl(totalSaldo)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  Limpar
                </Button>
                <Button
                  size="sm"
                  className="bg-lime-600 hover:bg-lime-700 text-white"
                  onClick={() => {
                    setBaixaData(fmtDate(new Date(), 'yyyy-MM-dd'));
                    setOpenBaixaLote(true);
                  }}
                >
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Baixar totalmente
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      <Dialog open={openBaixaLote} onOpenChange={setOpenBaixaLote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Baixa em lote</DialogTitle>
            <DialogDescription>
              Todas as parcelas em aberto dos {selected.size} título(s) selecionado(s) serão marcadas como pagas
              e os títulos ficarão como <b>Integral / Quitado</b>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data do pagamento</Label>
              <Input type="date" value={baixaData} onChange={(e) => setBaixaData(e.target.value)} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={baixaForma} onValueChange={setBaixaForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-muted/40 border p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Total a baixar</span>
                <span className="font-bold text-amber-600">
                  {brl(titulosFiltrados.filter(t => selected.has(t.id)).reduce((s, t) => s + Number(t.valor_pendente ?? t.valor_total ?? 0), 0))}
                </span>
              </div>
              <div className="text-xs text-muted-foreground max-h-40 overflow-auto border-t pt-2">
                {titulosFiltrados.filter(t => selected.has(t.id)).map(t => (
                  <div key={t.id} className="flex justify-between py-0.5">
                    <span>{ticketNumber(t.id)} · {t.customer_name}</span>
                    <span className="font-medium text-amber-600">{brl(Number(t.valor_pendente ?? t.valor_total ?? 0))}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenBaixaLote(false)}>Cancelar</Button>
            <Button
              className="bg-lime-600 hover:bg-lime-700 text-white"
              disabled={baixarLote.isPending || !baixaData}
              onClick={async () => {
                try {
                  const res = await baixarLote.mutateAsync({
                    tituloIds: Array.from(selected),
                    data_pagamento: baixaData,
                    forma_pagamento: baixaForma,
                  });
                  toast.success(`Baixados ${res.titulos} título(s) e ${res.parcelas} parcela(s).`);
                  setSelected(new Set());
                  setOpenBaixaLote(false);
                } catch (e: any) {
                  toast.error(e?.message || 'Erro ao baixar títulos em lote');
                }
              }}
            >
              {baixarLote.isPending ? 'Baixando…' : 'Confirmar baixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
        <TabsContent value="kanban" className="mt-4">
          <KanbanCobranca />
        </TabsContent>
        <TabsContent value="reconciliacao" className="mt-4">
          <ReconciliacaoPanel />
        </TabsContent>
        {([
          ['agenda', AgendaCobrancas],
          ['pendencias', PendenciasMes],
          ['inadimplencia', InadimplenciaHistorica],
          ['resultados', ResultadosCobrador],
        ] as const).map(([v, C]) => (
          <TabsContent key={v} value={v} className="mt-4 space-y-4">
            <C filtros={filtrosGestao} />
          </TabsContent>
        ))}
        <TabsContent value="juridica" className="mt-4 space-y-4">
          <CobrancaJuridica filtros={filtrosGestao} onAbrir={(id) => navigate(`/financeiro/a-receber/${id}`)} />
        </TabsContent>
        <TabsContent value="relatorios" className="mt-4 space-y-4">
          <RelatoriosNotas filtros={filtrosGestao} />
        </TabsContent>
      </Tabs>
      <ReembolsosPanel open={openReembolsos} onOpenChange={setOpenReembolsos} />
      <DuplicidadePanel open={openDuplicidade} onOpenChange={setOpenDuplicidade} />
      {cobrancaTitulo && (
        <CobrancaResponsavelDialog
          titulo={cobrancaTitulo}
          open={!!cobrancaTitulo}
          onOpenChange={(v) => { if (!v) setCobrancaTitulo(null); }}
        />
      )}
      <CadastroManualDialog open={openCadastroManual} onOpenChange={setOpenCadastroManual} />
      <ClientePainelLateral key={painelTitulo?.id ?? "none"} titulo={painelTitulo} onClose={() => setPainelTitulo(null)} />
    </div>
  );
}