import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ComparisonEntry } from '@/hooks/useCloserComparison';
import { Users, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DailyTargets } from '@/components/relatorios/InvestigationEvolutionChart';

interface Props {
  data: ComparisonEntry[];
  highlightId: string | null;
  title?: string;
  dailyTargets?: DailyTargets;
  daysInPeriod?: number;
}

type SortKey = 'name' | 'total' | 'realizadas' | 'noShows' | 'contratosPagos' | 'taxaComparecimento' | 'taxaConversao' | 'taxaNoShow' | 'metaPercent';

function getMetaPercent(entry: ComparisonEntry, dailyTargets?: DailyTargets, daysInPeriod?: number): number {
  if (!dailyTargets?.contratosPagos || !daysInPeriod) return 0;
  const periodTarget = dailyTargets.contratosPagos * daysInPeriod;
  return periodTarget > 0 ? (entry.contratosPagos / periodTarget) * 100 : 0;
}

export function InvestigationComparisonTable({ data, highlightId, title, dailyTargets, daysInPeriod }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('contratosPagos');
  const [sortAsc, setSortAsc] = useState(false);

  if (data.length === 0) return null;

  const hasTargets = !!dailyTargets?.contratosPagos && !!daysInPeriod;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (sortKey === 'metaPercent') {
      const av = getMetaPercent(a, dailyTargets, daysInPeriod);
      const bv = getMetaPercent(b, dailyTargets, daysInPeriod);
      return sortAsc ? av - bv : bv - av;
    }
    const av = a[sortKey as keyof ComparisonEntry];
    const bv = b[sortKey as keyof ComparisonEntry];
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const SortBtn = ({ label, field }: { label: string; field: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          {title || 'Tabela Comparativa do Time'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead><SortBtn label="Nome" field="name" /></TableHead>
              <TableHead className="text-center"><SortBtn label="Total" field="total" /></TableHead>
              <TableHead className="text-center"><SortBtn label="Realizadas" field="realizadas" /></TableHead>
              <TableHead className="text-center"><SortBtn label="No-Shows" field="noShows" /></TableHead>
              <TableHead className="text-center"><SortBtn label="Contratos" field="contratosPagos" /></TableHead>
              {hasTargets && <TableHead className="text-center"><SortBtn label="% Meta" field="metaPercent" /></TableHead>}
              <TableHead className="text-center"><SortBtn label="% Comp." field="taxaComparecimento" /></TableHead>
              <TableHead className="text-center"><SortBtn label="% Conv." field="taxaConversao" /></TableHead>
              <TableHead className="text-center"><SortBtn label="% No-Show" field="taxaNoShow" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((entry, i) => {
              const metaPct = hasTargets ? getMetaPercent(entry, dailyTargets, daysInPeriod) : 0;
              const metaColor = metaPct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : metaPct >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive';
              return (
                <TableRow
                  key={entry.id}
                  className={cn(
                    entry.id === highlightId && 'bg-primary/5 font-semibold border-l-2 border-l-primary'
                  )}
                >
                  <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell className="text-center">{entry.total}</TableCell>
                  <TableCell className="text-center text-emerald-600 dark:text-emerald-400">{entry.realizadas}</TableCell>
                  <TableCell className="text-center text-destructive">{entry.noShows}</TableCell>
                  <TableCell className="text-center font-bold text-amber-600 dark:text-amber-400">{entry.contratosPagos}</TableCell>
                  {hasTargets && (
                    <TableCell className={cn("text-center font-bold", metaColor)}>
                      {metaPct.toFixed(0)}%
                    </TableCell>
                  )}
                  <TableCell className="text-center">{entry.taxaComparecimento.toFixed(1)}%</TableCell>
                  <TableCell className="text-center font-semibold">{entry.taxaConversao.toFixed(1)}%</TableCell>
                  <TableCell className="text-center text-destructive">{entry.taxaNoShow.toFixed(1)}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}