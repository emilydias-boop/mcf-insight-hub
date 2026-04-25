import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Info, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { ChannelFunnelRow } from '@/hooks/useChannelFunnelReport';

interface Props {
  rows: ChannelFunnelRow[];
  totals: {
    entradas: number; r1Agendada: number; r1Realizada: number; noShow: number; contratoPago: number;
    r2Agendada: number; r2Realizada: number; aprovados: number; reprovados: number;
    proximaSemana: number; vendaFinal: number; faturamentoBruto: number; faturamentoLiquido: number;
  };
}

function pct(n: number): string {
  if (!isFinite(n) || n <= 0) return '—';
  return `${n.toFixed(1)}%`;
}

function pctBadge(n: number) {
  if (!isFinite(n) || n <= 0) return <span className="text-muted-foreground">—</span>;
  const variant = n >= 50 ? 'default' : n >= 20 ? 'secondary' : 'outline';
  return <Badge variant={variant as any} className="font-mono">{n.toFixed(1)}%</Badge>;
}

function pctBadgeInverted(n: number) {
  // Para No-Show: quanto menor, melhor
  if (!isFinite(n) || n <= 0) return <span className="text-muted-foreground">—</span>;
  const variant = n >= 30 ? 'destructive' : n >= 20 ? 'secondary' : 'default';
  return <Badge variant={variant as any} className="font-mono">{n.toFixed(1)}%</Badge>;
}

function HeaderWithInfo({ label, info, align = 'right' }: { label: string; info: string; align?: 'left' | 'right' }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 cursor-help ${align === 'right' ? 'justify-end w-full' : ''}`}>
            {label}
            <Info className="h-3 w-3 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {info}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ChannelFunnelTable({ rows, totals }: Props) {
  const totalConv = {
    r1AgToReal: totals.r1Agendada > 0 ? (totals.r1Realizada / totals.r1Agendada) * 100 : 0,
    r1RealToContrato: totals.r1Realizada > 0 ? (totals.contratoPago / totals.r1Realizada) * 100 : 0,
    aprovadoToVenda: totals.aprovados > 0 ? (totals.vendaFinal / totals.aprovados) * 100 : 0,
    entradaToVenda: totals.entradas > 0 ? (totals.vendaFinal / totals.entradas) * 100 : 0,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Funil por Canal</CardTitle>
        <p className="text-sm text-muted-foreground">
          Jornada completa do lead por canal de aquisição: do primeiro contato à venda final.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background min-w-[160px]">
                      <HeaderWithInfo
                        label="Canal"
                        info="Classificação 100% por TAG do deal + histórico de compra A010. A pipeline/origem NÃO classifica mais. ANAMNESE: tag ANAMNESE / ANAMNESE-INSTA / LIVE / LANÇAMENTO (sem INCOMPLETA), ou compra A010 com mais de 30 dias. A010: compra A010 ≤30 dias antes do deal, ou tag A010 sem compra. OUTROS: nenhum sinal — inclui formulários abandonados (ANAMNESE-INCOMPLETA) e leads do pipeline Piloto Anamnese sem tag completa."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="Entradas"
                        info="Deals criados no período (crm_deals.created_at), filtrados pela BU. Canal definido só por tag + compra A010 (pipeline não classifica). Tag ANAMNESE-INCOMPLETA isolada cai em OUTROS."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="R1 Agend."
                        info="Agendamentos R1 criados no período (booked_at), filtrados pela BU do SDR no momento do agendamento. Cap de 2 reagendamentos por deal — alinhado ao Painel Comercial e à página Reuniões Equipe."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="R1 Realiz."
                        info="R1 com status realizada/completed no período selecionado (scheduled_at dentro do range), filtradas pela BU. Cap de 2 reagendamentos por deal."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="No-Show"
                        info="R1 com status no_show no período selecionado, filtradas pela BU. Cap de 2 reagendamentos por deal."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="Contrato Pago"
                        info="Attendees R1 com contract_paid_at dentro do período, OU deals que entraram no estágio 'Contrato Pago' no período. Atribuído ao canal do deal (TAG + compra A010)."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="R2 Agend."
                        info="Attendees de reuniões R2 com scheduled_at dentro do período exato selecionado (não mais semanas inteiras de carrinho — alinhado ao filtro de datas desde a última atualização). Deduplicado por deal."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="R2 Realiz."
                        info="R2 com status completed/realizada no período exato selecionado. Deduplicado por deal."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="Aprovados"
                        info="Attendees R2 com r2_status_name contendo 'aprovado' no período exato selecionado. Independe da data do contrato — apenas a R2 conta no período."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="Reprovados"
                        info="Attendees R2 cujo r2_status_name indica saída do carrinho (reembolso, desistente, reprovado, cancelado) no período selecionado."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="Próx. Semana"
                        info="Attendees R2 marcados como 'Próxima semana' (lead que será trabalhado na próxima safra) cuja R2 ocorreu no período."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="Venda Final"
                        info="Primeira conversão em Parceria por cliente (e-mail) no período. Inclui apenas produtos de venda nova: A001/A002/A003/A004/A005/A009 completo. Exclui A000-Contrato, renovações, Club isolado, A010, Vitalício, e clientes que já eram parceiros nos últimos 12 meses. Bruto = reference_price. Líquido = valor recebido no Hubla. Canal (apenas TAG + compra A010, pipeline não classifica): (1) compra A010 ≤30 dias antes da venda → A010; (2) tags LIVE/ANAMNESE/ANAMNESE-INSTA/LANÇAMENTO (sem INCOMPLETA) → ANAMNESE; (3) compra A010 >30 dias → ANAMNESE (lead reciclado); (4) só tag A010 sem compra → A010; (5) sem nenhum sinal → OUTROS."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="Fat. Bruto"
                        info="Soma de reference_price (preço de tabela) das vendas finais únicas no período. Não é o valor recebido — é o preço cheio configurado em product_configurations."
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <HeaderWithInfo
                        label="Fat. Líquido"
                        info="Soma do valor efetivamente recebido no Hubla (product_price, líquido de descontos) das vendas finais únicas no período."
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.channel}>
                      <TableCell className="sticky left-0 bg-background font-medium">{r.channelLabel}</TableCell>
                      <TableCell className="text-right">{r.entradas}</TableCell>
                      <TableCell className="text-right">{r.r1Agendada}</TableCell>
                      <TableCell className="text-right">{r.r1Realizada}</TableCell>
                      <TableCell className="text-right text-destructive">{r.noShow}</TableCell>
                      <TableCell className="text-right">{r.contratoPago}</TableCell>
                      <TableCell className="text-right">{r.r2Agendada}</TableCell>
                      <TableCell className="text-right">{r.r2Realizada}</TableCell>
                      <TableCell className="text-right text-success">{r.aprovados}</TableCell>
                      <TableCell className="text-right text-destructive">{r.reprovados}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.proximaSemana}</TableCell>
                      <TableCell className="text-right font-semibold">{r.vendaFinal}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.faturamentoBruto)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(r.faturamentoLiquido)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/30 font-semibold">
                    <TableCell className="sticky left-0 bg-muted/30">Total</TableCell>
                    <TableCell className="text-right">{totals.entradas}</TableCell>
                    <TableCell className="text-right">{totals.r1Agendada}</TableCell>
                    <TableCell className="text-right">{totals.r1Realizada}</TableCell>
                    <TableCell className="text-right text-destructive">{totals.noShow}</TableCell>
                    <TableCell className="text-right">{totals.contratoPago}</TableCell>
                    <TableCell className="text-right">{totals.r2Agendada}</TableCell>
                    <TableCell className="text-right">{totals.r2Realizada}</TableCell>
                    <TableCell className="text-right text-success">{totals.aprovados}</TableCell>
                    <TableCell className="text-right text-destructive">{totals.reprovados}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{totals.proximaSemana}</TableCell>
                    <TableCell className="text-right">{totals.vendaFinal}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.faturamentoBruto)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.faturamentoLiquido)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Conversões agregadas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ConversionCard label="R1 Ag → R1 Real" value={totalConv.r1AgToReal} />
              <ConversionCard label="R1 Real → Contrato Pago" value={totalConv.r1RealToContrato} />
              <ConversionCard label="Aprovado → Venda Final" value={totalConv.aprovadoToVenda} />
              <ConversionCard label="Entrada → Venda Final" value={totalConv.entradaToVenda} />
            </div>

            {/* Tabela de conversões por canal */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Canal — Conversões</TableHead>
                    <TableHead className="text-right">R1 Ag → Real</TableHead>
                    <TableHead className="text-right">R1 Real → Contrato</TableHead>
                    <TableHead className="text-right">Taxa No-Show</TableHead>
                    <TableHead className="text-right">Aprovado → Venda</TableHead>
                    <TableHead className="text-right">Entrada → Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={`conv-${r.channel}`}>
                      <TableCell className="font-medium">{r.channelLabel}</TableCell>
                      <TableCell className="text-right">{pctBadge(r.r1AgToReal)}</TableCell>
                      <TableCell className="text-right">{pctBadge(r.r1RealToContrato)}</TableCell>
                      <TableCell className="text-right">{pctBadgeInverted(r.taxaNoShow)}</TableCell>
                      <TableCell className="text-right">{pctBadge(r.aprovadoToVenda)}</TableCell>
                      <TableCell className="text-right">{pctBadge(r.entradaToVenda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Notas metodológicas */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group">
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                <span className="underline">Notas metodológicas — por que estes números diferem do Painel Comercial?</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 rounded-md border bg-muted/30 p-4 text-xs space-y-3">
                <p className="text-foreground">
                  O <strong>Funil por Canal</strong> e o <strong>Painel Comercial</strong> medem perspectivas diferentes — ambos estão corretos, mas servem para análises distintas.
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-foreground">1. Janela de tempo (booked_at vs scheduled_at)</p>
                    <p className="text-muted-foreground">
                      <strong>Painel</strong>: conta o ato de agendar feito no período (<code>booked_at</code>). Um agendamento feito em 28/abr para 5/mai conta em abril.
                      <br />
                      <strong>Funil</strong>: conta a R1 marcada para o período (<code>scheduled_at</code>). Uma R1 agendada em março mas marcada para abril conta em abril.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">2. Critério de inclusão (SDR vs Origem do deal)</p>
                    <p className="text-muted-foreground">
                      <strong>Painel</strong>: filtra por SDRs com squad da BU no momento do agendamento (via <code>sdr_squad_history</code>). Inclui agendamentos do SDR Inc em deals de outras BUs.
                      <br />
                      <strong>Funil</strong>: filtra pela origem do deal (<code>origin_id</code> da BU). Mede a perspectiva do lead.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">3. Deduplicação (cap 2 vs deal único)</p>
                    <p className="text-muted-foreground">
                      <strong>Painel</strong>: aplica cap de até 2 movimentos por deal em métricas como R1 Agendada; "Agendamentos" não tem cap.
                      <br />
                      <strong>Funil</strong>: conta deals únicos — reagendamentos do mesmo deal não inflam o número (1 deal = 1 unidade).
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground italic">
                  Para gestão e produtividade do time SDR, use o <strong>Painel Comercial</strong>. Para análise de canal e jornada do lead, use o <strong>Funil por Canal</strong>.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConversionCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-bold">{pct(value)}</p>
      </CardContent>
    </Card>
  );
}