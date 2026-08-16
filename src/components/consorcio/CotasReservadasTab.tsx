import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/consorcioCalculos';
import { useConsorcioCotasReservadas, medianDias } from '@/hooks/useConsorcioCotasOrigem';

/**
 * Etapa 5 do Funil Consórcio — "Cadastradas" (reservadas na Embracon).
 *
 * Fonte: `consortium_cards.data_reserva` no período + origem no funil.
 *
 * ATENÇÃO (processo, não código): esta etapa só descreve o processo real de
 * cadastramento/pagamento na Embracon se a equipe abrir a cota como RESERVA e
 * converter em contratação quando a administradora confirmar. Se as duas datas
 * forem gravadas no mesmo instante, a etapa vira espelho da etapa 6 (Cotas).
 */
export function CotasReservadasTab({ range }: { range: { startDate?: Date; endDate?: Date } }) {
  const { data: cotas = [], isLoading } = useConsorcioCotasReservadas(range);
  const mediana = medianDias(cotas);
  const fmt = (d?: string | null) => (d ? format(new Date(`${d}T00:00:00`), 'dd/MM/yyyy') : '—');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          Cadastradas — reservadas na Embracon ({cotas.length})
        </CardTitle>
        <Badge variant="outline" className="whitespace-nowrap">
          {mediana != null ? `Mediana: ${mediana} dia${mediana === 1 ? '' : 's'} até contratar` : 'Mediana: —'}
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : cotas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma cota reservada no período com origem no funil.
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
                {cotas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-center">
                      {c.grupo} / {c.cota}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(c.valor_credito)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmt(c.data_reserva)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmt(c.data_contratacao)}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {c.dias != null ? c.dias : '—'}
                    </TableCell>
                    <TableCell>{c.vendedor_name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
