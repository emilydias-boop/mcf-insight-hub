import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComparisonPeriod, ComparisonMetric } from "@/types/dashboard";
import { formatCustomWeekRange } from "@/lib/dateHelpers";

interface ComparisonTableProps {
  periodoA: ComparisonPeriod;
  periodoB: ComparisonPeriod;
  metricas: ComparisonMetric[];
}

export function ComparisonTable({ periodoA, periodoB, metricas }: ComparisonTableProps) {

  const renderTrend = (diff: number, diffPercent: number, isPositive: boolean) => {
    if (diff === 0) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Minus className="h-4 w-4" />
          <span>-</span>
        </div>
      );
    }

    const isGood = (diff > 0 && isPositive) || (diff < 0 && !isPositive);

    return (
      <div className={cn("flex items-center gap-2", isGood ? "text-success" : "text-destructive")}>
        {diff > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        <span className="font-semibold">{Math.abs(diffPercent).toFixed(1)}%</span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparação Detalhada</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">
                  <div className="text-primary">Período A</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {formatCustomWeekRange(periodoA.inicio)}
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className="text-success">Período B</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {formatCustomWeekRange(periodoB.inicio)}
                  </div>
                </TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">% Variação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metricas.map((metrica) => (
                <TableRow key={metrica.name}>
                  <TableCell className="font-medium">{metrica.name}</TableCell>
                  <TableCell className="text-right">
                    {metrica.name.includes('Vendas') || metrica.name === 'Leads'
                      ? formatNumber(metrica.periodA)
                      : metrica.name === 'ROI' 
                        ? formatPercent(metrica.periodA, 1)
                        : metrica.name === 'ROAS'
                          ? `${metrica.periodA.toFixed(2)}x`
                          : formatCurrency(metrica.periodA)
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    {metrica.name.includes('Vendas') || metrica.name === 'Leads'
                      ? formatNumber(metrica.periodB)
                      : metrica.name === 'ROI'
                        ? formatPercent(metrica.periodB, 1)
                        : metrica.name === 'ROAS'
                          ? `${metrica.periodB.toFixed(2)}x`
                          : formatCurrency(metrica.periodB)
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "font-medium",
                      metrica.diff > 0 && metrica.isPositive ? "text-success" :
                      metrica.diff < 0 && !metrica.isPositive ? "text-success" :
                      metrica.diff !== 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {metrica.diff > 0 ? '+' : ''}
                      {metrica.name.includes('Vendas') || metrica.name === 'Leads'
                        ? formatNumber(metrica.diff)
                        : metrica.name === 'ROI'
                          ? formatPercent(metrica.diff, 1) + 'pp'
                          : metrica.name === 'ROAS'
                            ? metrica.diff.toFixed(2) + 'x'
                            : formatCurrency(Math.abs(metrica.diff))
                      }
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {renderTrend(metrica.diff, metrica.diffPercent, metrica.isPositive)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
