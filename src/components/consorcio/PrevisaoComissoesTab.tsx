import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronRight,
  CalendarDays,
  TrendingUp,
  Wallet,
  Layers,
  Search,
  Inbox,
  BanknoteArrowUp,
} from 'lucide-react';
import {
  useConsorcioPrevisaoComissoes,
  PrevisaoSemana,
} from '@/hooks/useConsorcioPrevisaoComissoes';
import { formatCurrency } from '@/lib/formatters';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function fmtDate(iso: string) {
  return format(parseISO(iso), "dd 'de' MMM", { locale: ptBR });
}
function fmtDateFull(iso: string) {
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
}

function SemanaRow({
  semana,
  isOpen,
  onToggle,
  isNext,
  search,
}: {
  semana: PrevisaoSemana;
  isOpen: boolean;
  onToggle: () => void;
  isNext: boolean;
  search: string;
}) {
  const parcelasFiltradas = useMemo(() => {
    if (!search.trim()) return semana.parcelas;
    const s = search.toLowerCase();
    return semana.parcelas.filter(
      (p) =>
        p.cliente.toLowerCase().includes(s) ||
        p.vendedorNome.toLowerCase().includes(s) ||
        p.grupo.toLowerCase().includes(s) ||
        p.cota.toLowerCase().includes(s),
    );
  }, [semana.parcelas, search]);

  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/40 ${isNext ? 'bg-primary/5' : ''}`}
        onClick={onToggle}
      >
        <TableCell className="w-8">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="font-medium">
          #{semana.n}
          {isNext && (
            <Badge variant="default" className="ml-2 text-[10px]">
              Próxima
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <span className="text-sm">
            {fmtDate(semana.apuracaoInicio)} → {fmtDate(semana.apuracaoFim)}
          </span>
        </TableCell>
        <TableCell>
          <span className="font-medium">{fmtDateFull(semana.dataPagamento)}</span>
        </TableCell>
        <TableCell className="text-right">{semana.totalCotas}</TableCell>
        <TableCell className="text-right">{semana.totalParcelas}</TableCell>
        <TableCell className="text-right text-muted-foreground">
          {formatCurrency(semana.totalValorParcela)}
        </TableCell>
        <TableCell className="text-right font-semibold text-primary">
          {formatCurrency(semana.totalComissao)}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {semana.obs || '-'}
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/20 p-0">
            {parcelasFiltradas.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Nenhuma parcela paga nessa semana.
              </div>
            ) : (
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Grupo/Cota</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Pago em</TableHead>
                      <TableHead className="text-right">Valor Crédito</TableHead>
                      <TableHead className="text-right">Valor Parcela</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead>Vendedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelasFiltradas.map((p) => (
                      <TableRow key={p.installmentId}>
                        <TableCell className="font-medium">{p.cliente}</TableCell>
                        <TableCell>
                          {p.grupo}/{p.cota}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {p.tipoProduto}
                          </Badge>
                        </TableCell>
                        <TableCell>{p.numeroParcela}ª</TableCell>
                        <TableCell>{fmtDateFull(p.dataPagamento)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(p.valorCredito)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(p.valorParcela)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatCurrency(p.valorComissao)}
                        </TableCell>
                        <TableCell className="text-sm">{p.vendedorNome}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function PrevisaoComissoesTab() {
  const { data, isLoading } = useConsorcioPrevisaoComissoes();
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'com-parcelas' | 'futuras'>(
    'com-parcelas',
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  const semanasFiltradas = data.semanas.filter((w) => {
    if (filtro === 'com-parcelas') return w.totalParcelas > 0;
    if (filtro === 'futuras') return w.dataPagamento >= hoje;
    return true;
  });

  const totalProxima = data.proximaSemana?.totalComissao ?? 0;
  const semanasComParcelas = data.semanas.filter((w) => w.totalParcelas > 0).length;

  // Semana vigente de CAPTURA: hoje dentro do período de apuração (qui→qua)
  const semanaCaptura = data.semanas.find(
    (w) => hoje >= w.apuracaoInicio && hoje <= w.apuracaoFim,
  );
  // Semana vigente de PAGAMENTO: já é proximaSemana (primeira com pagamento >= hoje)
  const semanaPagamento = data.proximaSemana;

  return (
    <div className="space-y-6">
      {/* Destaque — Semana vigente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Inbox className="h-4 w-4 text-amber-500" />
              Semana de Captura (em andamento)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {semanaCaptura ? (
              <>
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(semanaCaptura.totalComissao)}
                  </div>
                  <Badge variant="outline" className="border-amber-500/50">
                    Semana #{semanaCaptura.n}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Apuração {fmtDate(semanaCaptura.apuracaoInicio)} → {fmtDate(semanaCaptura.apuracaoFim)} ·{' '}
                  {semanaCaptura.totalParcelas} parcelas · {semanaCaptura.totalCotas} cotas
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pagamento previsto em <span className="font-medium">{fmtDateFull(semanaCaptura.dataPagamento)}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Fora do calendário 2026.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BanknoteArrowUp className="h-4 w-4 text-primary" />
              Semana de Pagamento (a receber)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {semanaPagamento ? (
              <>
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(semanaPagamento.totalComissao)}
                  </div>
                  <Badge variant="default">Semana #{semanaPagamento.n}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Apuração {fmtDate(semanaPagamento.apuracaoInicio)} → {fmtDate(semanaPagamento.apuracaoFim)} ·{' '}
                  {semanaPagamento.totalParcelas} parcelas · {semanaPagamento.totalCotas} cotas
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cai na conta em <span className="font-medium">{fmtDateFull(semanaPagamento.dataPagamento)}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem pagamentos futuros previstos.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Comissão Total Prevista (2026)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(data.totalGeralComissao)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.totalGeralParcelas} parcelas pagas
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Próximo Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalProxima)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.proximaSemana
                ? `Semana #${data.proximaSemana.n} · paga em ${fmtDateFull(data.proximaSemana.dataPagamento)}`
                : 'Sem semanas futuras'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Semanas com movimentação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{semanasComParcelas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              de {data.semanas.length} semanas no calendário 2026
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Média por Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                semanasComParcelas > 0
                  ? data.totalGeralComissao / semanasComParcelas
                  : 0,
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              considerando semanas com parcelas pagas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <CardTitle className="text-base">
              Previsão Semanal — Calendário Embracon 2026
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente, vendedor, cota..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Select
                value={filtro}
                onValueChange={(v: 'todas' | 'com-parcelas' | 'futuras') =>
                  setFiltro(v)
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="com-parcelas">Só com parcelas</SelectItem>
                  <SelectItem value="futuras">Pagamentos futuros</SelectItem>
                  <SelectItem value="todas">Todas as semanas</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() =>
                  setOpenWeek(openWeek === -1 ? null : -1)
                }
              >
                {openWeek === -1 ? 'Recolher tudo' : 'Expandir tudo'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Semana</TableHead>
                  <TableHead>Período de Apuração</TableHead>
                  <TableHead>Data de Pagamento</TableHead>
                  <TableHead className="text-right">Cotas</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                  <TableHead className="text-right">Valor Parcelas</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>OBS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {semanasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhuma semana corresponde aos filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  semanasFiltradas.map((s) => (
                    <SemanaRow
                      key={s.n}
                      semana={s}
                      isOpen={openWeek === -1 || openWeek === s.n}
                      onToggle={() =>
                        setOpenWeek((cur) =>
                          cur === s.n || cur === -1 ? null : s.n,
                        )
                      }
                      isNext={data.proximaSemana?.n === s.n}
                      search={search}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
