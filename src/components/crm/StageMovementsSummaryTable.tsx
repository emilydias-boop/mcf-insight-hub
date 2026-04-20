import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import type { StageMovementsSummaryRow } from '@/hooks/useStageMovements';

interface Props {
  rows: StageMovementsSummaryRow[];
  selectedStageId: string | null;
  onSelectStage: (stageId: string | null) => void;
  isLoading?: boolean;
}

export function StageMovementsSummaryTable({
  rows,
  selectedStageId,
  onSelectStage,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Carregando resumo...
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Nenhuma movimentação encontrada no período.
      </div>
    );
  }

  const totalUnique = rows.reduce((acc, r) => acc + r.uniqueLeads, 0);
  const totalPasses = rows.reduce((acc, r) => acc + r.totalPassages, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Estágio</TableHead>
          <TableHead className="text-right">Leads únicos</TableHead>
          <TableHead className="text-right">Passagens</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const isSelected = selectedStageId === r.stageId;
          return (
            <TableRow
              key={r.stageId}
              data-state={isSelected ? 'selected' : undefined}
              className="cursor-pointer"
              onClick={() => onSelectStage(isSelected ? null : r.stageId)}
            >
              <TableCell className="font-medium">{r.stageName}</TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary">{r.uniqueLeads}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="outline">{r.totalPassages}</Badge>
              </TableCell>
              <TableCell>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    isSelected && 'rotate-90 text-primary',
                  )}
                />
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/30 font-semibold hover:bg-muted/30">
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{totalUnique}</TableCell>
          <TableCell className="text-right">{totalPasses}</TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}