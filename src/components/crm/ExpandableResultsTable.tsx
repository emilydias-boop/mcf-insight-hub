import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SpreadsheetRow } from '@/hooks/useSpreadsheetCompare';

interface Props {
  filteredResults: SpreadsheetRow[];
  extraColumnHeaders: string[];
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusLabel: (status: string) => string;
}

export function ExpandableResultsTable({ filteredResults, extraColumnHeaders, getStatusIcon, getStatusLabel }: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const hasExtras = extraColumnHeaders.length > 0;
  const colCount = 6 + (hasExtras ? 1 : 0);

  const toggleRow = (idx: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="border rounded-lg max-h-[50vh] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {hasExtras && <TableHead className="text-xs w-8"></TableHead>}
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Nome (Planilha)</TableHead>
            <TableHead className="text-xs">Tel (Planilha)</TableHead>
            <TableHead className="text-xs">Nome (Sistema)</TableHead>
            <TableHead className="text-xs">Tel (Sistema)</TableHead>
            <TableHead className="text-xs">Pipeline / Estágio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredResults.slice(0, 200).map((row, i) => {
            const isExpanded = expandedRows.has(i);
            const rowHasExtras = hasExtras && Object.values(row.extraColumns || {}).some(v => v && v !== '');
            return (
              <>
                <TableRow
                  key={`row-${i}`}
                  className={`${row.matchStatus === 'not_found' ? 'opacity-60' : ''} ${rowHasExtras ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                  onClick={() => rowHasExtras && toggleRow(i)}
                >
                  {hasExtras && (
                    <TableCell className="py-1 w-8 px-2">
                      {rowHasExtras && (
                        isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="py-1">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(row.matchStatus)}
                      <span className="text-xs">{getStatusLabel(row.matchStatus)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs py-1">{row.excelName}</TableCell>
                  <TableCell className="text-xs py-1">{row.excelPhone}</TableCell>
                  <TableCell className="text-xs py-1">{row.localContactName || '—'}</TableCell>
                  <TableCell className="text-xs py-1">{row.localContactPhone || '—'}</TableCell>
                  <TableCell className="text-xs py-1">
                    {row.matchStatus === 'found_in_current' && row.localStageName ? (
                      <Badge variant="outline" className="text-xs">{row.localStageName}</Badge>
                    ) : row.matchStatus === 'found_elsewhere' && row.originName ? (
                      <Badge className="bg-amber-500/20 text-amber-700 text-xs">{row.originName}</Badge>
                    ) : '—'}
                  </TableCell>
                </TableRow>
                {isExpanded && rowHasExtras && (
                  <TableRow key={`extra-${i}`} className="bg-muted/30">
                    <TableCell colSpan={colCount} className="py-2 px-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1">
                        {extraColumnHeaders.map(h => {
                          const val = row.extraColumns?.[h];
                          if (!val) return null;
                          return (
                            <div key={h} className="text-xs">
                              <span className="font-medium text-muted-foreground">{h}:</span>{' '}
                              <span>{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
          {filteredResults.length > 200 && (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center text-xs text-muted-foreground py-2">
                Mostrando 200 de {filteredResults.length} resultados.
              </TableCell>
            </TableRow>
          )}
          {filteredResults.length === 0 && (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center text-xs text-muted-foreground py-4">
                Nenhum resultado encontrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
