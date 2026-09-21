import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, ChevronDown, Camera, Info, TrendingDown, Target, Gift } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/formatters';
import { EmbraconImportDialog } from './EmbraconImportDialog';
import {
  useEmbraconIndices,
  useEmbraconConfig,
  useEmbraconProducao,
  useSalvarProducao,
  useCotasImportadasJanela,
  useCotasRiscoMcf,
  useRegistrarSnapshot,
  useEmbraconSnapshots,
  IndiceClassRow,
} from '@/hooks/useEmbraconClass';

/**
 * Aba "Índices Class" — 12-6 (cancelamento) e 8-2 (inadimplência).
 * Espec: docs/embracon-class-indices.md
 *
 * Só leitura e cálculo. O simulador é estado de tela: não grava nada nas cotas.
 */

const PREMISSAS = [
  'Critério do "Período Produção": mês da venda, da adesão ou da 1ª assembleia?',
  'Janela e fórmula do 8-2 (M−7 a M−2?) e se as canceladas entram.',
  'Regra de cancelamento (2 parcelas vencidas + quantos dias).',
  'Limite oficial do Class: 25% ou 22,5%.',
  'Rotina mensal de importação do Power BI (detalhe 12-6 e 8-2 com valor do bem por cota).',
];

const MESES = Array.from({ length: 13 }, (_, i) => {
  const d = i <= 6 ? subMonths(new Date(), 6 - i) : addMonths(new Date(), i - 6);
  const iso = `${format(d, 'yyyy-MM')}-01`;
  return { value: iso, label: format(d, 'MMMM yyyy', { locale: ptBR }) };
});

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);
const mesLabel = (iso: string) => format(new Date(`${iso.slice(0, 10)}T00:00:00`), 'MMM/yy', { locale: ptBR });

function SeloAConfirmar({ motivo }: { motivo: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px] gap-1">
            ⚠️ a confirmar
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{motivo}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function IndicesClassTab() {
  const mesAtual = `${format(new Date(), 'yyyy-MM')}-01`;
  const [mes, setMes] = useState(mesAtual);
  const [fonte, setFonte] = useState<FonteIndice>('mcf');
  const [simulados, setSimulados] = useState<Record<string, { tipo: 'reativar' | 'pagar'; valor: number }>>({});
  const [oficial, setOficial] = useState({ numerador: '', denominador: '' });
  const [novaProducao, setNovaProducao] = useState({ mes: mesAtual, valor: '' });

  const { data: rows = [], isLoading } = useEmbraconIndices(mes, fonte);
  const { data: config } = useEmbraconConfig();
  const { data: producao = [] } = useEmbraconProducao();
  const salvarProducao = useSalvarProducao();
  const registrarSnapshot = useRegistrarSnapshot();
  const { data: snapshots = [] } = useEmbraconSnapshots(mes);
  const { data: risco = [] } = useCotasRiscoMcf();

  const linha126 = rows.find((r) => r.indice === '12-6' && r.mes_apuracao.slice(0, 7) === mes.slice(0, 7));
  const linha82 = rows.find((r) => r.indice === '8-2' && r.mes_apuracao.slice(0, 7) === mes.slice(0, 7));
  const temImportacao = rows[0]?.tem_importacao ?? false;
  /**
   * Na fonte MCF Gestão os números saem das próprias cotas: não existe bloqueio por
   * falta de importação. O aviso e o "—" só valem para a fonte Power BI sem lote.
   */
  const semDados = fonte === 'power_bi' && !temImportacao;
  const temDados = !semDados;

  const { data: canceladas = [] } = useCotasImportadasJanela(
    linha126?.janela_inicio,
    linha126?.janela_fim,
    ['cancelada'],
  );

  // Simulação: reativar baixa os dois índices; pagar boleto baixa só o 8-2.
  const ajuste = useMemo(() => {
    let reativado = 0;
    let pago = 0;
    for (const s of Object.values(simulados)) {
      if (s.tipo === 'reativar') reativado += s.valor;
      else pago += s.valor;
    }
    return { reativado, pago };
  }, [simulados]);

  const simular = (linha: IndiceClassRow | undefined) => {
    if (!linha || !linha.denominador) return null;
    const desconto = linha.indice === '12-6' ? ajuste.reativado : ajuste.reativado + ajuste.pago;
    const num = Math.max(0, linha.numerador - desconto);
    return { numerador: num, valor: num / linha.denominador };
  };

  const sim126 = simular(linha126);
  const sim82 = simular(linha82);
  const temSimulacao = ajuste.reativado + ajuste.pago > 0;

  const toggleSim = (key: string, tipo: 'reativar' | 'pagar', valor: number) =>
    setSimulados((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { tipo, valor };
      return next;
    });

  const janelaInicio = linha126?.janela_inicio;
  const janelaFim = linha126?.janela_fim;
  const proximaJanelaFim = janelaFim ? `${format(addMonths(new Date(`${janelaFim}T00:00:00`), 1), 'yyyy-MM')}-01` : undefined;

  const naJanela = (mesProducao: string) =>
    !!janelaInicio && !!proximaJanelaFim && mesProducao >= janelaInicio && mesProducao <= proximaJanelaFim;

  const cancelamentoIminente = risco.filter((c) => c.parcelas_vencidas >= 2 && naJanela(c.mes_producao));
  const umBoleto = risco.filter((c) => c.parcelas_vencidas === 1 && naJanela(c.mes_producao));

  const producaoMes = producao.find((p) => p.mes.slice(0, 7) === mes.slice(0, 7))?.valor ?? 0;
  const bonus = producaoMes * (config?.bonus_pct ?? 0.006);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {janelaInicio && janelaFim && (
            <span className="text-xs text-muted-foreground">
              Janela 12-6: {mesLabel(janelaInicio)} → {mesLabel(janelaFim)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <EmbraconImportDialog />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!linha126 || registrarSnapshot.isPending}
            onClick={async () => {
              for (const l of [linha126, linha82]) {
                if (!l) continue;
                await registrarSnapshot.mutateAsync({
                  mes_apuracao: mes,
                  indice: l.indice,
                  numerador: l.numerador,
                  denominador: l.denominador,
                  valor: l.indice_valor,
                  qtd_cotas: l.qtd_cotas,
                  fonte: 'calculado',
                });
              }
            }}
          >
            <Camera className="h-4 w-4" />
            Registrar snapshot do mês
          </Button>
        </div>
      </div>

      {!temImportacao && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            Sem importação do Power BI — os números de cancelamento e inadimplência não são
            calculados por suposição. Importe a planilha para ver os índices.
          </span>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" /> Índice 12-6
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <p className="text-lg font-bold">{temImportacao ? pct(linha126?.indice_valor) : '—'}</p>
            <p className="text-[11px] text-muted-foreground">
              meta {pct(config?.meta ?? 0.25)}
              {temImportacao && linha126?.indice_valor != null && (
                <> · {((linha126.indice_valor - (config?.meta ?? 0.25)) * 100).toFixed(1)} p.p.</>
              )}
            </p>
            {temSimulacao && sim126 && (
              <p className="text-[11px] text-emerald-500">simulado {pct(sim126.valor)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-amber-500" /> Índice 8-2
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-lg font-bold">{temImportacao ? pct(linha82?.indice_valor) : '—'}</p>
              <SeloAConfirmar motivo="A janela e a fórmula do 8-2 ainda não foram confirmadas com a Embracon. O denominador oficial do Power BI (R$ 164,70 mi em set/26) não bate com a série de produção — lance o oficial no snapshot para comparar." />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {linha82 && `${mesLabel(linha82.janela_inicio)} → ${mesLabel(linha82.janela_fim)}`}
            </p>
            {temSimulacao && sim82 && <p className="text-[11px] text-emerald-500">simulado {pct(sim82.valor)}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Produção da janela</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <p className="text-lg font-bold">{formatCurrency(linha126?.denominador ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">
              MCF Gestão: {formatCurrency(linha126?.denominador_mcf ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" /> Falta reativar p/ meta
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <p className="text-lg font-bold">
              {temImportacao && linha126 && linha126.falta_para_meta > 0
                ? formatCurrency(linha126.falta_para_meta)
                : temImportacao
                  ? 'meta atingida'
                  : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {temImportacao && linha126 ? `≈ ${linha126.cotas_para_meta} cota(s)` : 'sem importação'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5 text-emerald-500" /> Bônus Class estimado
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <p className="text-lg font-bold text-emerald-500">{formatCurrency(bonus)}</p>
            <p className="text-[11px] text-muted-foreground">
              {pct(config?.bonus_pct ?? 0.006)} da produção do mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projeção */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Projeção — mês atual + 3 próximos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left py-1.5">Mês</th>
                <th className="text-left py-1.5">Índice</th>
                <th className="text-left py-1.5">Janela</th>
                <th className="text-right py-1.5">Produção (denominador)</th>
                <th className="text-right py-1.5">Numerador</th>
                <th className="text-right py-1.5">Índice</th>
                <th className="text-right py-1.5">Meta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.mes_apuracao}-${r.indice}`} className="border-t border-border/50">
                  <td className="py-1.5">{mesLabel(r.mes_apuracao)}</td>
                  <td className="py-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {r.indice}
                    </Badge>
                  </td>
                  <td className="py-1.5">
                    {mesLabel(r.janela_inicio)} → {mesLabel(r.janela_fim)}
                  </td>
                  <td className="py-1.5 text-right">{formatCurrency(r.denominador)}</td>
                  <td className="py-1.5 text-right">{temImportacao ? formatCurrency(r.numerador) : '—'}</td>
                  <td
                    className={`py-1.5 text-right font-medium ${
                      temImportacao && r.indice_valor != null && r.indice_valor > r.meta ? 'text-destructive' : ''
                    }`}
                  >
                    {temImportacao ? pct(r.indice_valor) : '—'}
                  </td>
                  <td className="py-1.5 text-right text-muted-foreground">{pct(r.meta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Canceladas da janela por mês de produção */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Canceladas da janela por mês de produção</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!temImportacao ? (
            <p className="text-xs text-muted-foreground">Sem importação do Power BI.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left py-1.5">Mês de produção</th>
                  <th className="text-right py-1.5">Produção</th>
                  <th className="text-right py-1.5">Cotas canceladas</th>
                  <th className="text-right py-1.5">Crédito cancelado</th>
                  <th className="text-right py-1.5">% do mês</th>
                </tr>
              </thead>
              <tbody>
                {(linha126?.breakdown ?? []).map((b) => (
                  <tr key={b.mes} className="border-t border-border/50">
                    <td className="py-1.5">{mesLabel(b.mes)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(Number(b.producao) || 0)}</td>
                    <td className="py-1.5 text-right">{b.qtd_canceladas}</td>
                    <td className="py-1.5 text-right">{formatCurrency(Number(b.credito_canceladas) || 0)}</td>
                    <td className="py-1.5 text-right">
                      {Number(b.producao) > 0
                        ? pct(Number(b.credito_canceladas) / Number(b.producao))
                        : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="border-t font-medium">
                  <td className="py-1.5">Total</td>
                  <td className="py-1.5 text-right">{formatCurrency(linha126?.denominador ?? 0)}</td>
                  <td className="py-1.5 text-right">{linha126?.qtd_cotas ?? 0}</td>
                  <td className="py-1.5 text-right">{formatCurrency(linha126?.numerador ?? 0)}</td>
                  <td className="py-1.5 text-right">{pct(linha126?.indice_valor)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Simulador nas canceladas */}
      {canceladas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Canceladas da janela — simular reativação
              <Badge variant="outline" className="text-[10px]">
                não grava nada
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  <th className="text-left py-1.5">Grupo-cota</th>
                  <th className="text-left py-1.5">Mês produção</th>
                  <th className="text-right py-1.5">Valor do bem</th>
                </tr>
              </thead>
              <tbody>
                {canceladas.slice(0, 200).map((c) => {
                  const key = `canc-${c.id}`;
                  return (
                    <tr key={key} className="border-t border-border/50">
                      <td className="py-1.5">
                        <Checkbox
                          checked={!!simulados[key]}
                          onCheckedChange={() => toggleSim(key, 'reativar', c.valor_bem)}
                        />
                      </td>
                      <td className="py-1.5 font-mono">
                        {c.grupo}-{c.cota}
                      </td>
                      <td className="py-1.5">{c.mes_producao ? mesLabel(c.mes_producao) : '—'}</td>
                      <td className="py-1.5 text-right">{formatCurrency(c.valor_bem)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Listas do próprio MCF Gestão */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Cancelamento iminente ({cancelamentoIminente.length})
              <SeloAConfirmar motivo="Premissa: 2 parcelas vencidas + cerca de 12 dias. Regra de cancelamento ainda não confirmada com a Embracon." />
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {cancelamentoIminente.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma cota da janela com 2+ parcelas vencidas.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {cancelamentoIminente.map((c) => {
                    const key = `imin-${c.card_id}`;
                    return (
                      <tr key={key} className="border-t border-border/50">
                        <td className="py-1.5 w-8">
                          <Checkbox
                            checked={!!simulados[key]}
                            onCheckedChange={() => toggleSim(key, 'pagar', c.valor_credito)}
                          />
                        </td>
                        <td className="py-1.5">
                          <p className="truncate max-w-[180px]">{c.nome}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {c.grupo}-{c.cota} · {mesLabel(c.mes_producao)}
                          </p>
                        </td>
                        <td className="py-1.5 text-right">
                          <p>{formatCurrency(c.valor_credito)}</p>
                          <p className="text-[10px] text-destructive">{c.parcelas_vencidas} vencidas</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sai do 8-2 pagando 1 boleto ({umBoleto.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            {umBoleto.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma cota da janela com exatamente 1 parcela vencida.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {umBoleto.map((c) => {
                    const key = `boleto-${c.card_id}`;
                    return (
                      <tr key={key} className="border-t border-border/50">
                        <td className="py-1.5 w-8">
                          <Checkbox
                            checked={!!simulados[key]}
                            onCheckedChange={() => toggleSim(key, 'pagar', c.valor_credito)}
                          />
                        </td>
                        <td className="py-1.5">
                          <p className="truncate max-w-[180px]">{c.nome}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {c.grupo}-{c.cota} · {mesLabel(c.mes_producao)}
                          </p>
                        </td>
                        <td className="py-1.5 text-right">
                          <p>{formatCurrency(c.valor_credito)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            boleto {formatCurrency(c.valor_boleto)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {temSimulacao && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Badge variant="secondary">{Object.keys(simulados).length} cota(s) na simulação</Badge>
          <span>
            12-6 simulado: <strong>{pct(sim126?.valor)}</strong> · 8-2 simulado:{' '}
            <strong>{pct(sim82?.valor)}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSimulados({})}>
            Limpar simulação
          </Button>
        </div>
      )}

      {/* Snapshot oficial do Power BI + produção mensal */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lançar índice oficial do Power BI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Numerador (R$)</Label>
                <Input
                  value={oficial.numerador}
                  onChange={(e) => setOficial((o) => ({ ...o, numerador: e.target.value }))}
                  placeholder="68330000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Denominador (R$)</Label>
                <Input
                  value={oficial.denominador}
                  onChange={(e) => setOficial((o) => ({ ...o, denominador: e.target.value }))}
                  placeholder="164700000"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(['12-6', '8-2'] as const).map((ind) => (
                <Button
                  key={ind}
                  variant="outline"
                  size="sm"
                  disabled={!oficial.numerador || !oficial.denominador}
                  onClick={() => {
                    const num = Number(oficial.numerador);
                    const den = Number(oficial.denominador);
                    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return;
                    registrarSnapshot.mutate({
                      mes_apuracao: mes,
                      indice: ind,
                      numerador: num,
                      denominador: den,
                      valor: num / den,
                      qtd_cotas: null,
                      fonte: 'power_bi',
                    });
                  }}
                >
                  Registrar oficial {ind}
                </Button>
              ))}
            </div>
            {snapshots.length > 0 && (
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Snapshots do mês</p>
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between border-t border-border/50 py-1">
                    <span>
                      <Badge variant="outline" className="text-[10px] mr-1.5">
                        {s.indice}
                      </Badge>
                      {s.fonte === 'power_bi' ? 'Power BI' : 'calculado'}
                    </span>
                    <span>
                      {pct(s.valor)} · {formatCurrency(Number(s.numerador) || 0)} /{' '}
                      {formatCurrency(Number(s.denominador) || 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Produção mensal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Mês</Label>
                <Input
                  type="month"
                  value={novaProducao.mes.slice(0, 7)}
                  onChange={(e) => setNovaProducao((p) => ({ ...p, mes: `${e.target.value}-01` }))}
                />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Produção (R$)</Label>
                <Input
                  value={novaProducao.valor}
                  onChange={(e) => setNovaProducao((p) => ({ ...p, valor: e.target.value }))}
                  placeholder="29800000"
                />
              </div>
              <Button
                size="sm"
                disabled={!novaProducao.valor || salvarProducao.isPending}
                onClick={() => {
                  const valor = Number(novaProducao.valor);
                  if (!Number.isFinite(valor) || valor <= 0) return;
                  salvarProducao.mutate({ mes: novaProducao.mes, valor });
                }}
              >
                Salvar
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto text-xs">
              {producao.map((p) => (
                <div key={p.mes} className="flex justify-between border-t border-border/50 py-1">
                  <span>{mesLabel(p.mes)}</span>
                  <span className="text-muted-foreground">{formatCurrency(p.valor)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premissas pendentes */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Info className="h-4 w-4" />
            Premissas pendentes ({PREMISSAS.length})
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Card>
            <CardContent className="pt-4 text-xs space-y-2">
              <p className="text-muted-foreground">
                Itens da seção 8 da espec (docs/embracon-class-indices.md) que ainda dependem de
                confirmação. Números marcados com ⚠️ dependem destas premissas.
              </p>
              <ul className="list-disc pl-4 space-y-1">
                {PREMISSAS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="text-amber-600">
                Divergência conhecida: a espec cita R$ 164,70 mi de produção na janela do 8-2 de
                set/26, mas a série soma R$ 225,89 mi para fev/26→jul/26. O painel mostra o
                calculado pela série e permite lançar o oficial do Power BI acima para comparar.
              </p>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
