import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { SemanaMes } from "@/data/mockData";

interface ResumoFinanceiroProps {
  dados: SemanaMes[];
}

export function ResumoFinanceiro({ dados }: ResumoFinanceiroProps) {
  const [modo, setModo] = useState<'semanas' | 'mes'>('semanas');

  const calcularTotal = (campo: keyof Omit<SemanaMes, 'dataInicio' | 'dataFim'>) => {
    return dados.reduce((acc, item) => acc + (item[campo] || 0), 0);
  };

  const dadosMes = modo === 'mes' ? [{
    dataInicio: dados[0]?.dataInicio || '',
    dataFim: dados[dados.length - 1]?.dataFim || '',
    faturamentoA010: calcularTotal('faturamentoA010'),
    vendasA010: calcularTotal('vendasA010'),
    valorVendidoOBEvento: calcularTotal('valorVendidoOBEvento'),
    vendasOBEvento: calcularTotal('vendasOBEvento'),
    faturamentoContrato: calcularTotal('faturamentoContrato'),
    vendasContratos: calcularTotal('vendasContratos'),
    faturamentoOBConstruir: calcularTotal('faturamentoOBConstruir'),
    vendasOBConstruir: calcularTotal('vendasOBConstruir'),
    faturamentoOBVitalicio: calcularTotal('faturamentoOBVitalicio'),
    vendasOBVitalicio: calcularTotal('vendasOBVitalicio'),
    totalRevenue: calcularTotal('totalRevenue'),
    totalCost: calcularTotal('totalCost'),
    operatingProfit: calcularTotal('operatingProfit'),
    realCost: calcularTotal('realCost'),
    cir: calcularTotal('cir') / dados.length, // Média do CIR
  }] : dados;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">
            Resumo Financeiro - {modo === 'semanas' ? 'Semanas' : 'Mês'}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={modo === 'semanas' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setModo('semanas')}
            >
              Semanas
            </Button>
            <Button
              variant={modo === 'mes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setModo('mes')}
            >
              Mês
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Receita Total</TableHead>
                <TableHead className="text-right">Custo Total</TableHead>
                <TableHead className="text-right">Lucro Operacional</TableHead>
                <TableHead className="text-right">Custo Real</TableHead>
                <TableHead className="text-right">CIR %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dadosMes.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.dataInicio} - {item.dataFim}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{formatCurrency(item.totalRevenue || 0)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{formatCurrency(item.totalCost || 0)}</TableCell>
                  <TableCell className="text-right font-bold text-foreground">{formatCurrency(item.operatingProfit || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.realCost || 0)}</TableCell>
                  <TableCell className="text-right">{(item.cir || 0).toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
