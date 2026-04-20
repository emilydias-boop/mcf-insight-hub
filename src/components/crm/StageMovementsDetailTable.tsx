import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { StageMovementRow } from '@/hooks/useStageMovements';

interface Props {
  rows: StageMovementRow[];
  onOpenDeal: (dealId: string) => void;
  isLoading?: boolean;
}

const PAGE_SIZE = 50;

export function StageMovementsDetailTable({ rows, onOpenDeal, isLoading }: Props) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [rows, safePage],
  );

  const exportCSV = () => {
    const header = ['Lead', 'Pipeline', 'De', 'Para', 'Quando'];
    const lines = rows.map((r) =>
      [
        r.dealName,
        r.originName ?? '',
        r.fromStageName ?? '',
        r.toStageName,
        r.when ? format(new Date(r.when), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'parado no estágio',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimentacoes-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Carregando movimentações...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length.toLocaleString('pt-BR')} registro(s)
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4 mr-1" />
          Exportar CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
          Nenhuma movimentação para exibir.
        </div>
      ) : (
        <>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>De → Para</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.activityId}>
                    <TableCell>
                      <button
                        className="font-medium text-primary hover:underline text-left"
                        onClick={() => onOpenDeal(r.dealId)}
                      >
                        {r.dealName}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.originName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.isSnapshotOnly ? (
                        <span className="font-medium">{r.toStageName}</span>
                      ) : (
                        <>
                          <span className="text-muted-foreground">
                            {r.fromStageName ?? '(início)'}
                          </span>{' '}
                          → <span className="font-medium">{r.toStageName}</span>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.when ? (
                        format(new Date(r.when), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Parado no estágio
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {safePage + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}