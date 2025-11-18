import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComparisonPeriod, ComparisonMetric } from "@/types/dashboard";
import { formatCustomWeekRange } from "@/lib/dateHelpers";

interface ComparisonTableProps {
  periodoA: ComparisonPeriod;
  periodoB: ComparisonPeriod;
}

export function ComparisonTable({ periodoA, periodoB }: ComparisonTableProps) {
  // Mock data - em produção, buscar dados reais baseado nos períodos
  const metricas: ComparisonMetric[] = [
    { name: 'Faturamento', periodA: 180000, periodB: 200000, diff: 20000, diffPercent: 11.1, isPositive: true },
    { name: 'Custos', periodA: 120000, periodB: 110000, diff: -10000, diffPercent: -8.3, isPositive: true },
    { name: 'Lucro', periodA: 60000, periodB: 90000, diff: 30000, diffPercent: 50, isPositive: true },
    { name: 'ROI', periodA: 50, periodB: 81.8, diff: 31.8, diffPercent: 63.6, isPositive: true },
    { name: 'ROAS', periodA: 3.5, periodB: 4.2, diff: 0.7, diffPercent: 20, isPositive: true },
    { name: 'Vendas A010', periodA: 45, periodB: 52, diff: 7, diffPercent: 15.6, isPositive: true },
    { name: 'Vendas Contratos', periodA: 12, periodB: 15, diff: 3, diffPercent: 25, isPositive: true },
  ];

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
                    {metrica.name.includes('ROI') || metrica.name.includes('ROAS')
                      ? `${metrica.periodA.toFixed(1)}${metrica.name.includes('ROI') ? '%' : 'x'}`
                      : metrica.name.includes('Vendas')
                      ? metrica.periodA
                      : formatCurrency(metrica.periodA)}
                  </TableCell>
                  <TableCell className="text-right">
                    {metrica.name.includes('ROI') || metrica.name.includes('ROAS')
                      ? `${metrica.periodB.toFixed(1)}${metrica.name.includes('ROI') ? '%' : 'x'}`
                      : metrica.name.includes('Vendas')
                      ? metrica.periodB
                      : formatCurrency(metrica.periodB)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      "font-medium",
                      metrica.diff > 0 && metrica.isPositive ? "text-success" :
                      metrica.diff < 0 && !metrica.isPositive ? "text-success" :
                      metrica.diff !== 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {metrica.diff > 0 ? '+' : ''}
                      {metrica.name.includes('ROI') || metrica.name.includes('ROAS')
                        ? `${metrica.diff.toFixed(1)}${metrica.name.includes('ROI') ? 'pp' : 'x'}`
                        : metrica.name.includes('Vendas')
                        ? metrica.diff
                        : formatCurrency(metrica.diff)}
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
