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
import { Search, ExternalLink, Wallet, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useArTitulos, useFinanceiroUsers, useUpdateArTitulo } from '@/hooks/useAReceber';
import {
  AR_TITULO_STATUS_LABEL,
  AR_TITULO_TIPO_LABEL,
  type ArTituloStatus,
  type ArTitulo,
} from '@/types/aReceber';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ArGestoresDialog } from '@/components/financeiro/ArGestoresDialog';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const PRODUCT_OPTIONS = [
  { value: 'todos', label: 'Todos os produtos' },
  { value: 'A001', label: 'A001 - Incorporador Completo' },
  { value: 'A002', label: 'A002 - Incorporador Básico' },
  { value: 'A003', label: 'A003 - Anticrise Completo' },
  { value: 'A004', label: 'A004 - Anticrise Básico' },
  { value: 'A009', label: 'A009 - Incorporador + The Club' },
];

function StatusBadge({ status }: { status: ArTituloStatus }) {
  const cfg: Record<ArTituloStatus, { className: string; icon: any }> = {
    aberto: { className: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: Clock },
    quitado: { className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
    cancelado: { className: 'bg-muted text-muted-foreground', icon: AlertCircle },
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
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('aberto');
  const [tipo, setTipo] = useState<string>('todos');
  const [product, setProduct] = useState<string>('todos');
  const [responsavel, setResponsavel] = useState<string>('todos');

  const { data: titulos, isLoading } = useArTitulos({
    search: search || undefined,
    status: (status as any) === 'todos' ? undefined : (status as ArTituloStatus),
    tipo: tipo === 'todos' ? undefined : tipo,
    product_code: product === 'todos' ? undefined : product,
    responsavel_id: responsavel === 'todos' ? undefined : responsavel,
  });

  const { data: users } = useFinanceiroUsers();
  const updateTitulo = useUpdateArTitulo();

  const kpis = useMemo(() => {
    const list = titulos ?? [];
    const totalContratado = list.reduce((s, t) => s + Number(t.valor_total || 0), 0);
    const totalRecebido = list.reduce((s, t) => s + (t.valor_pago || 0), 0);
    const saldo = list.reduce((s, t) => s + (t.valor_pendente || 0), 0);
    const pendentesLancamento = list.filter(t => t.tipo === 'parcelado' && (t.parcelas_total ?? 0) === 0).length;
    return { totalContratado, totalRecebido, saldo, pendentesLancamento, qtd: list.length };
  }, [titulos]);

  const handleAssign = async (tituloId: string, userId: string) => {
    try {
      await updateTitulo.mutateAsync({ id: tituloId, responsavel_id: userId === 'none' ? null : userId });
      toast.success('Responsável atualizado');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar responsável');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">
            Gestão automática de títulos gerados a partir das vendas Hubla (A001, A002, A003, A004, A009).
          </p>
        </div>
        {isAdmin && <ArGestoresDialog />}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Valor contratado</CardTitle></CardHeader>
          <CardContent className="text-lg font-bold">{brl(kpis.totalContratado)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Recebido</CardTitle></CardHeader>
          <CardContent className="text-lg font-bold text-emerald-600">{brl(kpis.totalRecebido)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Saldo a receber</CardTitle></CardHeader>
          <CardContent className="text-lg font-bold text-amber-600">{brl(kpis.saldo)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Parcelados aguardando lançamento</CardTitle></CardHeader>
          <CardContent className="text-lg font-bold text-orange-600">{kpis.pendentesLancamento}</CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por cliente, e-mail, CPF…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="aberto">Em aberto</SelectItem>
              <SelectItem value="quitado">Quitado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="integral">Integral</SelectItem>
              <SelectItem value="parcelado">Parcelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              {PRODUCT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={responsavel} onValueChange={setResponsavel}>
            <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {(users ?? []).map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (titulos ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Nenhum título encontrado com os filtros atuais.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data venda</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(titulos ?? []).map(t => {
                  const precisaLancar = t.tipo === 'parcelado' && (t.parcelas_total ?? 0) === 0;
                  return (
                    <TableRow key={t.id} className={precisaLancar ? 'bg-orange-500/5' : undefined}>
                      <TableCell>
                        <div className="font-medium">{t.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{t.customer_email || t.customer_document || '—'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">{t.product_code}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-[180px]">{t.product_name}</div>
                      </TableCell>
                      <TableCell><TipoBadge tipo={t.tipo} /></TableCell>
                      <TableCell className="text-xs">
                        {t.sale_date ? format(new Date(t.sale_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">{brl(Number(t.valor_total))}</TableCell>
                      <TableCell className="text-right text-emerald-600">{brl(t.valor_pago || 0)}</TableCell>
                      <TableCell className="text-right text-amber-600">{brl(t.valor_pendente || 0)}</TableCell>
                      <TableCell className="text-xs">
                        {precisaLancar
                          ? <span className="text-orange-600 font-medium">Lançar</span>
                          : `${t.parcelas_pagas}/${t.parcelas_total}`}
                      </TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell>
                        <Select
                          value={t.responsavel_id ?? 'none'}
                          onValueChange={(v) => handleAssign(t.id, v)}
                        >
                          <SelectTrigger className="h-8 min-w-[140px]"><SelectValue placeholder="Definir…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Sem responsável —</SelectItem>
                            {(users ?? []).map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/financeiro/a-receber/${t.id}`)}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}