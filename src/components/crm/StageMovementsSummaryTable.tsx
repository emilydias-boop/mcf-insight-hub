import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ChevronRight, Info } from 'lucide-react';
import type { StageMovementsSummaryRow } from '@/hooks/useStageMovements';

interface Props {
  rows: StageMovementsSummaryRow[];
  selectedStageNameKey: string | null;
  onSelectStage: (stageNameKey: string | null) => void;
  isLoading?: boolean;
  totalUniqueLeads?: number;
}

export function StageMovementsSummaryTable({
  rows,
  selectedStageNameKey,
  onSelectStage,
  isLoading,
  totalUniqueLeads = 0,
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

  const totalAcumulado = rows.reduce((acc, r) => acc + r.uniqueLeads, 0);
  const totalPassagens = rows.reduce((acc, r) => acc + r.passagens, 0);
  const totalParados = rows.reduce((acc, r) => acc + r.parados, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Estágio</TableHead>
          <TableHead className="text-right">
            <span className="inline-flex items-center gap-1">
              Acumulado
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Leads únicos que passaram por este estágio <strong>dentro
                    do período selecionado</strong> (inclui inferência da
                    trilha do funil — leads em estágios avançados são
                    contados nos anteriores). Trocar o período altera este
                    número.
                  </p>
                </TooltipContent>
              </Tooltip>
            </span>
          </TableHead>
          <TableHead className="text-right text-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 cursor-help">
                  Passaram
                  <Info className="h-3 w-3 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Número de movimentações (eventos) que entraram neste
                  estágio no período selecionado.
                </p>
              </TooltipContent>
            </Tooltip>
          </TableHead>
          <TableHead className="text-right text-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 cursor-help">
                  Estão lá
                  <Info className="h-3 w-3 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Leads que estavam neste estágio no <strong>fim do período
                  selecionado</strong> (snapshot na data final, não "agora").
                </p>
              </TooltipContent>
            </Tooltip>
          </TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const isSelected = selectedStageNameKey === r.stageNameKey;
          return (
            <TableRow
              key={r.stageNameKey}
              data-state={isSelected ? 'selected' : undefined}
              className="cursor-pointer"
              onClick={() => onSelectStage(isSelected ? null : r.stageNameKey)}
            >
              <TableCell className="font-medium">{r.stageName}</TableCell>
              <TableCell className="text-right">
                <Badge variant="default" className="font-semibold">
                  {r.uniqueLeads}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary" className="text-xs">
                  {r.passagens}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className="text-xs">
                  {r.parados}
                </Badge>
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
        <TableRow className="bg-primary/10 font-semibold hover:bg-primary/10 border-t-2">
          <TableCell>
            <span className="inline-flex items-center gap-1 text-primary">
              Leads únicos no universo
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Total de oportunidades distintas que compõem o universo
                    deste filtro (origens + tags + período). Bate com o que
                    você vê no CRM filtrando os mesmos critérios.
                  </p>
                </TooltipContent>
              </Tooltip>
            </span>
          </TableCell>
          <TableCell className="text-right text-primary">{totalUniqueLeads}</TableCell>
          <TableCell className="text-right text-muted-foreground">—</TableCell>
          <TableCell className="text-right text-muted-foreground">—</TableCell>
          <TableCell />
        </TableRow>
        <TableRow className="bg-muted/30 text-muted-foreground hover:bg-muted/30">
          <TableCell>
            <span className="inline-flex items-center gap-1">
              Soma (passagens)
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Soma vertical da coluna Acumulado. Como um lead que avança
                    aparece em vários estágios (inferência da trilha), esse
                    número é maior que o de leads únicos — é esperado.
                  </p>
                </TooltipContent>
              </Tooltip>
            </span>
          </TableCell>
          <TableCell className="text-right">{totalAcumulado}</TableCell>
          <TableCell className="text-right">{totalPassagens}</TableCell>
          <TableCell className="text-right">{totalParados}</TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}
