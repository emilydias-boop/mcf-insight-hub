import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/consorcioCalculos';
import {
  useConsorcioCotasReservadas,
  useConsorcioReservasAguardando,
  useCotasComConfirmacaoEmbracon,
  diasParados,
  medianDias,
  medianDiasBase,
  type CotaReservada,
} from '@/hooks/useConsorcioCotasOrigem';
import { ConfirmarContratacaoModal } from './ConfirmarContratacaoModal';

const fmt = (d?: string | null) => (d ? format(new Date(`${d}T00:00:00`), 'dd/MM/yyyy') : '—');

/** Semáforo dos dias parados: neutro até 7, âmbar de 8 a 15, vermelho acima de 15. */
function DiasParados({ dias }: { dias: number | null }) {
  if (dias == null) return <span className="text-muted-foreground">—</span>;
  const cor =
    dias > 15
      ? 'text-destructive font-semibold'
      : dias >= 8
        ? 'text-amber-600 font-medium dark:text-amber-500'
        : 'text-foreground';
  return <span className={`tabular-nums ${cor}`}>{dias}</span>;
}

/**
 * Etapa 5 do Funil Consórcio — "Cadastradas".
 *
 * Duas seções:
 *  - Fila "Aguardando confirmação da Embracon": cotas abertas como RESERVA e sem
 *    data de contratação. IGNORA o filtro de período (reserva parada precisa aparecer).
 *  - "Confirmadas no período": reservas do período que já voltaram confirmadas.
 *
 * A cota reservada só entra na etapa "Cotas" quando é confirmada — aquela etapa
 * filtra por `data_contratacao`, que só é gravada na confirmação.
 */
export function CotasReservadasTab({ range }: { range: { startDate?: Date; endDate?: Date } }) {
  const { data: doPeriodo = [], isLoading } = useConsorcioCotasReservadas(range);
  const { data: fila = [], isLoading: loadingFila } = useConsorcioReservasAguardando();
  const [alvo, setAlvo] = useState<CotaReservada | null>(null);

  const confirmadas = useMemo(() => doPeriodo.filter((c) => !!c.data_contratacao), [doPeriodo]);
  const { data: comComprovante } = useCotasComConfirmacaoEmbracon(confirmadas.map((c) => c.id));

  const baseMediana = medianDiasBase(confirmadas);
  const mediana = medianDias(confirmadas);

  return (
    <div className="space-y-4">
      {/* Fila de trabalho — fora do filtro de período */}
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Aguardando confirmação da Embracon ({fila.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cotas abertas como reserva e ainda sem retorno da administradora. Esta seção ignora o filtro de
            período — uma reserva parada há semanas aparece aqui mesmo olhando o mês corrente.
          </p>
        </CardHeader>
        <CardContent>
          {loadingFila ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : fila.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma reserva aguardando confirmação.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-center">Grupo / Cota</TableHead>
                    <TableHead className="text-right">Valor do Crédito</TableHead>
                    <TableHead>Data de Reserva</TableHead>
                    <TableHead className="text-center">Dias parados</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fila.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-center">
                        {c.grupo} / {c.cota}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(c.valor_credito)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmt(c.data_reserva)}</TableCell>
                      <TableCell className="text-center">
                        <DiasParados dias={diasParados(c.data_reserva)} />
                      </TableCell>
                      <TableCell>{c.vendedor_name || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setAlvo(c)}>
                          Confirmar contratação
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmadas no período */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Confirmadas no período ({confirmadas.length})</CardTitle>
            <p className="text-xs text-muted-foreground">
              Reservas do período que a Embracon já confirmou. Respeita o filtro de período (data de reserva).
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="whitespace-nowrap">
              {mediana != null ? `Mediana: ${mediana} dia${mediana === 1 ? '' : 's'} até contratar` : 'Mediana: —'}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {baseMediana.length} cota{baseMediana.length === 1 ? '' : 's'} no cálculo (reserva e confirmação em
              dias diferentes)
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : confirmadas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma cota confirmada no período com origem no funil.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-center">Grupo / Cota</TableHead>
                    <TableHead className="text-right">Valor do Crédito</TableHead>
                    <TableHead>Data de Reserva</TableHead>
                    <TableHead>Data de Contratação</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                    <TableHead>Vendedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmadas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{c.nome}</span>
                          {comComprovante && !comComprovante.has(c.id) && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 text-amber-600 dark:text-amber-500"
                            >
                              sem comprovante
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {c.grupo} / {c.cota}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(c.valor_credito)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmt(c.data_reserva)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmt(c.data_contratacao)}</TableCell>
                      <TableCell className="text-center tabular-nums">{c.dias != null ? c.dias : '—'}</TableCell>
                      <TableCell>{c.vendedor_name || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmarContratacaoModal open={!!alvo} onOpenChange={(v) => !v && setAlvo(null)} cota={alvo} />
    </div>
  );
}
