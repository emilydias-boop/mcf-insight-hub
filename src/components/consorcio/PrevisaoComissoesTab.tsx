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
  Banknote,
} from 'lucide-react';
import {
  useConsorcioPrevisaoComissoes,
  PrevisaoSemana,
} from '@/hooks/useConsorcioPrevisaoComissoes';
import { useConsorcioPrevisaoMensal } from '@/hooks/useConsorcioPrevisaoMensal';
import { calcularComissao } from '@/lib/commissionCalculator';
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
  const { data: previsaoMensal, isLoading: loadingMensal } = useConsorcioPrevisaoMensal();
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'com-parcelas' | 'futuras'>(
    'com-parcelas',
  );
  const [mesFiltro, setMesFiltro] = useState<string | null>(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showHistoricoMensal, setShowHistoricoMensal] = useState(false);
  // Simulação de novas cotas
  const [simNovasCotas, setSimNovasCotas] = useState<number>(0);
  const [simTicket, setSimTicket] = useState<number>(100000);

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
  }).filter((w) => (mesFiltro ? w.dataPagamento.slice(0, 7) === mesFiltro : true));

  // Agrupa semanas por mês da DATA DE PAGAMENTO (cai na conta).
  const resumoMensal = (() => {
    const map = new Map<string, { ym: string; totalComissao: number; totalParcelas: number; totalCotasSet: Set<string>; semanas: number[] }>();
    for (const w of data.semanas) {
      const ym = w.dataPagamento.slice(0, 7);
      if (!map.has(ym)) map.set(ym, { ym, totalComissao: 0, totalParcelas: 0, totalCotasSet: new Set(), semanas: [] });
      const b = map.get(ym)!;
      b.totalComissao += w.totalComissao;
      b.totalParcelas += w.totalParcelas;
      for (const p of w.parcelas) b.totalCotasSet.add(p.cardId);
      b.semanas.push(w.n);
    }
    return Array.from(map.values())
      .sort((a, b) => a.ym.localeCompare(b.ym))
      .map((b) => ({
        ym: b.ym,
        label: format(parseISO(b.ym + '-01'), "MMM/yy", { locale: ptBR }),
        totalComissao: b.totalComissao,
        totalParcelas: b.totalParcelas,
        totalCotas: b.totalCotasSet.size,
        semanas: b.semanas.length,
      }));
  })();
  const mesAtualYm = hoje.slice(0, 7);

  // Previsão de Recebimento (por vencimento) — combinando realizado + previsto + simulação
  const comissaoPorNovaCota = calcularComissao(simTicket || 0, 'select', 1);
  const previsaoRows = (previsaoMensal?.rows ?? []).map((r) => {
    const isFuturo = r.ym >= mesAtualYm;
    const simulado = isFuturo ? (simNovasCotas || 0) * comissaoPorNovaCota : 0;
    return {
      ...r,
      simulado,
      total: r.comissaoPaga + r.comissaoAVencer + r.comissaoAtrasada + simulado,
      isFuturo,
    };
  });
  const totalPrevisaoGeral = previsaoRows.reduce((s, r) => s + r.total, 0);

  // Mês âncora para separar histórico vs atuais (mês anterior em diante)
  const [aAno, aMes] = mesAtualYm.split('-').map(Number);
  const mesAnteriorYm =
    aMes === 1 ? `${aAno - 1}-12` : `${aAno}-${String(aMes - 1).padStart(2, '0')}`;

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
              <Banknote className="h-4 w-4 text-primary" />
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

      {/* Resumo Mensal — agrupado pela Data de Pagamento Embracon (cai na conta) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Resumo Mensal — por mês de pagamento (cai na conta)
            </CardTitle>
            {mesFiltro && (
              <Button variant="ghost" size="sm" onClick={() => setMesFiltro(null)}>
                Limpar filtro de mês
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {resumoMensal.map((m) => {
              const isAtual = m.ym === mesAtualYm;
              const isSelected = mesFiltro === m.ym;
              return (
                <button
                  key={m.ym}
                  type="button"
                  onClick={() => setMesFiltro(isSelected ? null : m.ym)}
                  className={`text-left rounded-lg border p-3 transition hover:border-primary/60 hover:bg-muted/40 ${
                    isSelected ? 'border-primary bg-primary/10' : isAtual ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium capitalize text-muted-foreground">
                      {m.label}
                    </span>
                    {isAtual && (
                      <Badge variant="outline" className="text-[9px] border-amber-500/50 px-1 py-0">
                        atual
                      </Badge>
                    )}
                  </div>
                  <div className={`text-base font-bold mt-1 ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {formatCurrency(m.totalComissao)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {m.semanas} semanas · {m.totalParcelas} parcelas · {m.totalCotas} cotas
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Previsão de Recebimento Mensal — por vencimento das parcelas */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Previsão de Recebimento Mensal
                <span className="text-xs font-normal text-muted-foreground">
                  · por vencimento das parcelas (cotas ativas/contempladas)
                </span>
              </CardTitle>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase">Total previsto 2026</div>
                <div className="text-lg font-bold text-primary">{formatCurrency(totalPrevisaoGeral)}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground">Simular novas cotas / mês</label>
                <Input
                  type="number"
                  min={0}
                  value={simNovasCotas || ''}
                  onChange={(e) => setSimNovasCotas(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-32 h-8"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground">Ticket médio do crédito (R$)</label>
                <Input
                  type="number"
                  min={0}
                  value={simTicket || ''}
                  onChange={(e) => setSimTicket(Number(e.target.value) || 0)}
                  placeholder="100000"
                  className="w-40 h-8"
                />
              </div>
              <div className="text-muted-foreground self-center">
                Comissão por nova cota (1ª parc. SELECT):{' '}
                <span className="font-semibold text-foreground">{formatCurrency(comissaoPorNovaCota)}</span>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" /> Pago&nbsp;&nbsp;
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" /> A vencer&nbsp;&nbsp;
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" /> Atrasado&nbsp;&nbsp;
              <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1" /> Simulado (novas cotas)
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMensal ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">A vencer</TableHead>
                    <TableHead className="text-right">Atrasado</TableHead>
                    <TableHead className="text-right">Simulado</TableHead>
                    <TableHead className="text-right">Total previsto</TableHead>
                    <TableHead className="text-right">Parcelas</TableHead>
                    <TableHead className="text-right">Cotas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previsaoRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                        Sem parcelas no período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (() => {
                      const historico = previsaoRows.filter((r) => r.ym < mesAnteriorYm);
                      const atuais = previsaoRows.filter((r) => r.ym >= mesAnteriorYm);
                      const totalHistComissao = historico.reduce((s, r) => s + r.total, 0);
                      const totalHistParcelas = historico.reduce(
                        (s, r) => s + r.parcelasPagas + r.parcelasAVencer + r.parcelasAtrasadas,
                        0,
                      );
                      const totalHistCotas = new Set(historico.flatMap((r) => Array.from(r.cotasSet))).size;

                      return (
                        <>
                          {historico.length > 0 && (
                            <>
                              <TableRow
                                className="cursor-pointer bg-muted/30 hover:bg-muted/50"
                                onClick={() => setShowHistoricoMensal((v) => !v)}
                              >
                                <TableCell className="w-8">
                                  {showHistoricoMensal ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </TableCell>
                                <TableCell colSpan={4} className="text-sm">
                                  <span className="font-medium">Histórico</span>
                                  <span className="text-muted-foreground ml-2">
                                    · {historico.length} meses anteriores · {totalHistParcelas} parcelas · {totalHistCotas} cotas
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-muted-foreground">
                                  {formatCurrency(totalHistComissao)}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {totalHistParcelas}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {totalHistCotas}
                                </TableCell>
                              </TableRow>
                              {showHistoricoMensal &&
                                historico.map((r) => {
                                  const isAtual = r.ym === mesAtualYm;
                                  return (
                                    <TableRow key={r.ym} className={isAtual ? 'bg-amber-500/5' : ''}>
                                      <TableCell className="font-medium capitalize">
                                        {format(parseISO(r.ym + '-01'), "MMM 'de' yyyy", { locale: ptBR })}
                                        {isAtual && (
                                          <Badge variant="outline" className="ml-2 text-[9px] border-amber-500/50">
                                            atual
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(r.comissaoPaga)}
                                      </TableCell>
                                      <TableCell className="text-right text-amber-600 dark:text-amber-400">
                                        {formatCurrency(r.comissaoAVencer)}
                                      </TableCell>
                                      <TableCell className="text-right text-red-600 dark:text-red-400">
                                        {formatCurrency(r.comissaoAtrasada)}
                                      </TableCell>
                                      <TableCell className="text-right text-primary">
                                        {r.simulado > 0 ? formatCurrency(r.simulado) : '-'}
                                      </TableCell>
                                      <TableCell className="text-right font-bold">
                                        {formatCurrency(r.total)}
                                      </TableCell>
                                      <TableCell className="text-right text-xs text-muted-foreground">
                                        {r.parcelasPagas + r.parcelasAVencer + r.parcelasAtrasadas}
                                      </TableCell>
                                      <TableCell className="text-right text-xs text-muted-foreground">
                                        {r.cotasSet.size}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </>
                          )}
                          {atuais.map((r) => {
                            const isAtual = r.ym === mesAtualYm;
                            return (
                              <TableRow key={r.ym} className={isAtual ? 'bg-amber-500/5' : ''}>
                                <TableCell className="font-medium capitalize">
                                  {format(parseISO(r.ym + '-01'), "MMM 'de' yyyy", { locale: ptBR })}
                                  {isAtual && (
                                    <Badge variant="outline" className="ml-2 text-[9px] border-amber-500/50">
                                      atual
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(r.comissaoPaga)}
                                </TableCell>
                                <TableCell className="text-right text-amber-600 dark:text-amber-400">
                                  {formatCurrency(r.comissaoAVencer)}
                                </TableCell>
                                <TableCell className="text-right text-red-600 dark:text-red-400">
                                  {formatCurrency(r.comissaoAtrasada)}
                                </TableCell>
                                <TableCell className="text-right text-primary">
                                  {r.simulado > 0 ? formatCurrency(r.simulado) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                  {formatCurrency(r.total)}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {r.parcelasPagas + r.parcelasAVencer + r.parcelasAtrasadas}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {r.cotasSet.size}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </>
                      );
                    })()
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <CardTitle className="text-base">
              Previsão Semanal — Calendário Embracon 2026
              {mesFiltro && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  · filtrado por {format(parseISO(mesFiltro + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              )}
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
                  (() => {
                    // Âncora: semana de pagamento atual (primeira com pagamento >= hoje).
                    // "Atuais" = da semana anterior à âncora em diante.
                    // "Histórico" = tudo antes da semana anterior à âncora.
                    const anchorN = data.proximaSemana?.n ?? Infinity;
                    const cutoffN = anchorN - 1;
                    const historico = semanasFiltradas.filter((s) => s.n < cutoffN);
                    const atuais = semanasFiltradas.filter((s) => s.n >= cutoffN);
                    const totalHistComissao = historico.reduce((s, w) => s + w.totalComissao, 0);
                    const totalHistParcelas = historico.reduce((s, w) => s + w.totalParcelas, 0);

                    return (
                      <>
                        {historico.length > 0 && (
                          <>
                            <TableRow
                              className="cursor-pointer bg-muted/30 hover:bg-muted/50"
                              onClick={() => setShowHistorico((v) => !v)}
                            >
                              <TableCell className="w-8">
                                {showHistorico ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </TableCell>
                              <TableCell colSpan={5} className="text-sm">
                                <span className="font-medium">Histórico</span>
                                <span className="text-muted-foreground ml-2">
                                  · {historico.length} semanas anteriores · {totalHistParcelas} parcelas
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">—</TableCell>
                              <TableCell className="text-right font-semibold text-muted-foreground">
                                {formatCurrency(totalHistComissao)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {showHistorico ? 'clique para recolher' : 'clique para expandir'}
                              </TableCell>
                            </TableRow>
                            {showHistorico &&
                              historico.map((s) => (
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
                              ))}
                          </>
                        )}
                        {atuais.map((s) => (
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
                        ))}
                      </>
                    );
                  })()
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
