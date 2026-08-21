import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/consorcioCalculos';
import {
  useConsorcioCotasReservadas,
  useConsorcioReservasAguardando,
  useCotasComConfirmacaoEmbracon,
  elegivelSeloComprovante,
  diasParados,
  medianDias,
  medianDiasBase,
  type CotaReservada,
} from '@/hooks/useConsorcioCotasOrigem';
import { ConfirmarContratacaoModal } from './ConfirmarContratacaoModal';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { TablePagination } from '@/components/ui/table-pagination';
import { useTableSortUrl } from '@/hooks/useTableSortUrl';
import { useDebounce } from '@/hooks/useDebounce';
import { ordenarPor } from '@/lib/ordenacaoTabela';

const fmt = (d?: string | null) => (d ? format(new Date(`${d}T00:00:00`), 'dd/MM/yyyy') : '—');

const num = (v: unknown) => {
  const s = String(v ?? '').replace(/\D/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * Grupo e cota são texto no banco, mas ordenam como número.
 * Sem grupo E sem cota devolve `null` — o comparador manda vazio para o fim.
 */
const grupoCota = (c: CotaReservada) => {
  const g = num(c.grupo);
  const ct = num(c.cota);
  if (g === null && ct === null) return null;
  return (g ?? 0) * 1_000_000 + (ct ?? 0);
};

const FILA_FIELDS = ['nome', 'grupo_cota', 'valor_credito', 'data_reserva', 'dias_parados', 'vendedor'] as const;
type FilaField = (typeof FILA_FIELDS)[number];
const FILA_EXTRATORES: Record<FilaField, (c: CotaReservada) => unknown> = {
  nome: (c) => c.nome,
  grupo_cota: grupoCota,
  valor_credito: (c) => Number(c.valor_credito) || 0,
  data_reserva: (c) => (c.data_reserva ? new Date(`${c.data_reserva}T00:00:00`) : null),
  dias_parados: (c) => diasParados(c.data_reserva),
  vendedor: (c) => c.vendedor_name || '',
};

const PERIODO_FIELDS = [
  'nome', 'grupo_cota', 'valor_credito', 'data_reserva', 'data_contratacao', 'dias', 'vendedor',
] as const;
type PeriodoField = (typeof PERIODO_FIELDS)[number];
const PERIODO_EXTRATORES: Record<PeriodoField, (c: CotaReservada) => unknown> = {
  nome: (c) => c.nome,
  grupo_cota: grupoCota,
  valor_credito: (c) => Number(c.valor_credito) || 0,
  data_reserva: (c) => (c.data_reserva ? new Date(`${c.data_reserva}T00:00:00`) : null),
  data_contratacao: (c) => (c.data_contratacao ? new Date(`${c.data_contratacao}T00:00:00`) : null),
  dias: (c) => c.dias,
  vendedor: (c) => c.vendedor_name || '',
};

const casaBusca = (c: CotaReservada, term: string) =>
  !term ||
  `${c.nome || ''} ${c.grupo || ''} ${c.cota || ''} ${c.vendedor_name || ''}`.toLowerCase().includes(term);

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
 * Etapa 5 do Funil Consórcio — "Cotas Cadastradas".
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

  // ── Tabela A: fila de confirmação (params ordA/dirA/qA)
  const sortA = useTableSortUrl<FilaField>({
    campos: FILA_FIELDS,
    inicial: { field: 'data_reserva', dir: 'asc' },
    sufixo: 'A',
  });
  const [buscaA, setBuscaA] = useState(sortA.q);
  const termoA = useDebounce(buscaA, 300);
  useEffect(() => { sortA.setQ(termoA); /* eslint-disable-next-line */ }, [termoA]);
  const [pageA, setPageA] = useState(0);
  const [pageSizeA, setPageSizeA] = useState(25);

  // ── Tabela B: etapa 5 no período (params ordB/dirB/qB)
  const sortB = useTableSortUrl<PeriodoField>({
    campos: PERIODO_FIELDS,
    inicial: { field: 'data_reserva', dir: 'desc' },
    sufixo: 'B',
  });
  const [buscaB, setBuscaB] = useState(sortB.q);
  const termoB = useDebounce(buscaB, 300);
  useEffect(() => { sortB.setQ(termoB); /* eslint-disable-next-line */ }, [termoB]);
  const [pageB, setPageB] = useState(0);
  const [pageSizeB, setPageSizeB] = useState(25);

  const confirmadas = useMemo(() => doPeriodo.filter((c) => !!c.data_contratacao), [doPeriodo]);
  const filaFunil = useMemo(() => fila.filter((c) => c.origemFunil), [fila]);
  const filaExternas = useMemo(() => fila.filter((c) => !c.origemFunil), [fila]);

  // filtrar → buscar → ordenar → paginar
  const filaRows = useMemo(() => {
    const term = termoA.trim().toLowerCase();
    return ordenarPor(fila.filter((c) => casaBusca(c, term)), FILA_EXTRATORES[sortA.field], sortA.dir);
  }, [fila, termoA, sortA.field, sortA.dir]);
  const totalPagesA = Math.max(1, Math.ceil(filaRows.length / pageSizeA));
  const safePageA = Math.min(pageA, totalPagesA - 1);
  const filaPage = useMemo(
    () => filaRows.slice(safePageA * pageSizeA, (safePageA + 1) * pageSizeA),
    [filaRows, safePageA, pageSizeA],
  );
  useEffect(() => { setPageA(0); }, [termoA, sortA.field, sortA.dir, pageSizeA]);

  const confirmadasRows = useMemo(() => {
    const term = termoB.trim().toLowerCase();
    return ordenarPor(confirmadas.filter((c) => casaBusca(c, term)), PERIODO_EXTRATORES[sortB.field], sortB.dir);
  }, [confirmadas, termoB, sortB.field, sortB.dir]);
  const totalPagesB = Math.max(1, Math.ceil(confirmadasRows.length / pageSizeB));
  const safePageB = Math.min(pageB, totalPagesB - 1);
  const confirmadasPage = useMemo(
    () => confirmadasRows.slice(safePageB * pageSizeB, (safePageB + 1) * pageSizeB),
    [confirmadasRows, safePageB, pageSizeB],
  );
  useEffect(() => { setPageB(0); }, [termoB, sortB.field, sortB.dir, pageSizeB]);
  // Só consultamos comprovante das cotas confirmadas pelo fluxo novo.
  const { data: comComprovante } = useCotasComConfirmacaoEmbracon(
    confirmadas.filter(elegivelSeloComprovante).map((c) => c.id),
  );

  const baseMediana = medianDiasBase(confirmadas);
  const mediana = medianDias(confirmadas);

  return (
    <div className="space-y-4">
      {/* Fila de trabalho — fora do filtro de período */}
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Fila de confirmação — todas as reservas em aberto ({fila.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, grupo, cota ou vendedor..."
                value={buscaA}
                onChange={(e) => setBuscaA(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Reservas sem retorno da administradora · <strong>ignora o filtro de período</strong> ·{' '}
            {filaFunil.length} do funil e {filaExternas.length} externa
            {filaExternas.length === 1 ? '' : 's'} (externas não contam na etapa 5).
          </p>
        </CardHeader>
        <CardContent>
          {loadingFila ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : filaRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {fila.length === 0
                ? 'Nenhuma reserva aguardando confirmação.'
                : 'Nenhuma reserva corresponde à busca.'}
            </p>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead field="nome" active={sortA.field} dir={sortA.dir} onSort={sortA.toggle}>Nome</SortableTableHead>
                    <SortableTableHead field="grupo_cota" active={sortA.field} dir={sortA.dir} onSort={sortA.toggle} className="text-center" align="center">Grupo / Cota</SortableTableHead>
                    <SortableTableHead field="valor_credito" active={sortA.field} dir={sortA.dir} onSort={sortA.toggle} className="text-right" align="right">Valor do Crédito</SortableTableHead>
                    <SortableTableHead field="data_reserva" active={sortA.field} dir={sortA.dir} onSort={sortA.toggle}>Data de Reserva</SortableTableHead>
                    <SortableTableHead field="dias_parados" active={sortA.field} dir={sortA.dir} onSort={sortA.toggle} className="text-center" align="center">Dias parados</SortableTableHead>
                    <SortableTableHead field="vendedor" active={sortA.field} dir={sortA.dir} onSort={sortA.toggle}>Vendedor</SortableTableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filaPage.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{c.nome}</span>
                          {!c.origemFunil && (
                            <Badge variant="outline" className="whitespace-nowrap">
                              externa
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {c.grupo || c.cota ? (
                          <>{c.grupo || '—'} / {c.cota || '—'}</>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            sem grupo/cota
                          </Badge>
                        )}
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
            <TablePagination
              page={safePageA}
              pageSize={pageSizeA}
              total={filaRows.length}
              onPageChange={setPageA}
              onPageSizeChange={setPageSizeA}
            />
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmadas no período */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">
              Etapa 5 no período — reservas do funil já confirmadas ({confirmadas.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Reservas do período que a Embracon já confirmou. Respeita o filtro de período (data de reserva).
            </p>
            <p className="text-[11px] text-muted-foreground">
              Etapa 5 (Cotas Cadastradas) no período = {doPeriodo.length} cota{doPeriodo.length === 1 ? '' : 's'} com
              origem no funil reservadas no período: {confirmadas.length} confirmada
              {confirmadas.length === 1 ? '' : 's'} + {doPeriodo.length - confirmadas.length} em aberto. É este
              total que a bolinha da etapa 5 exibe. Já a <strong>fila acima</strong> é outro conjunto: todas as
              reservas em aberto de qualquer data, incluindo as externas.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, grupo, cota ou vendedor..."
                value={buscaB}
                onChange={(e) => setBuscaB(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
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
          ) : confirmadasRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {confirmadas.length === 0
                ? 'Nenhuma cota confirmada no período com origem no funil.'
                : 'Nenhuma cota corresponde à busca.'}
            </p>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead field="nome" active={sortB.field} dir={sortB.dir} onSort={sortB.toggle}>Nome</SortableTableHead>
                    <SortableTableHead field="grupo_cota" active={sortB.field} dir={sortB.dir} onSort={sortB.toggle} className="text-center" align="center">Grupo / Cota</SortableTableHead>
                    <SortableTableHead field="valor_credito" active={sortB.field} dir={sortB.dir} onSort={sortB.toggle} className="text-right" align="right">Valor do Crédito</SortableTableHead>
                    <SortableTableHead field="data_reserva" active={sortB.field} dir={sortB.dir} onSort={sortB.toggle}>Data de Reserva</SortableTableHead>
                    <SortableTableHead field="data_contratacao" active={sortB.field} dir={sortB.dir} onSort={sortB.toggle}>Data de Contratação</SortableTableHead>
                    <SortableTableHead field="dias" active={sortB.field} dir={sortB.dir} onSort={sortB.toggle} className="text-center" align="center">Dias</SortableTableHead>
                    <SortableTableHead field="vendedor" active={sortB.field} dir={sortB.dir} onSort={sortB.toggle}>Vendedor</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmadasPage.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{c.nome}</span>
                          {elegivelSeloComprovante(c) && comComprovante && !comComprovante.has(c.id) && (
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
            <TablePagination
              page={safePageB}
              pageSize={pageSizeB}
              total={confirmadasRows.length}
              onPageChange={setPageB}
              onPageSizeChange={setPageSizeB}
            />
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmarContratacaoModal open={!!alvo} onOpenChange={(v) => !v && setAlvo(null)} cota={alvo} />
    </div>
  );
}
