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
    return dados.reduce((acc, item) => acc + item[campo], 0);
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
  }] : dados;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">
            {modo === 'semanas' ? 'Semanas' : 'Mês'} (A010 + Contratos + Custos)
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
                <TableHead>Data Início</TableHead>
                <TableHead>Data Fim</TableHead>
                <TableHead className="text-right">Faturamento A010</TableHead>
                <TableHead className="text-right">Vendas A010</TableHead>
                <TableHead className="text-right">Valor OB Evento</TableHead>
                <TableHead className="text-right">Vendas OB Evento</TableHead>
                <TableHead className="text-right">Faturamento Contrato</TableHead>
                <TableHead className="text-right">Vendas Contratos</TableHead>
                <TableHead className="text-right">Faturamento OB Construir</TableHead>
                <TableHead className="text-right">Vendas OB Construir</TableHead>
                <TableHead className="text-right">Faturamento OB Vitalício</TableHead>
                <TableHead className="text-right">Vendas OB Vitalício</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dadosMes.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.dataInicio}</TableCell>
                  <TableCell className="font-medium">{item.dataFim}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.faturamentoA010)}</TableCell>
                  <TableCell className="text-right">{item.vendasA010}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.valorVendidoOBEvento)}</TableCell>
                  <TableCell className="text-right">{item.vendasOBEvento}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.faturamentoContrato)}</TableCell>
                  <TableCell className="text-right">{item.vendasContratos}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.faturamentoOBConstruir)}</TableCell>
                  <TableCell className="text-right">{item.vendasOBConstruir}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.faturamentoOBVitalicio)}</TableCell>
                  <TableCell className="text-right">{item.vendasOBVitalicio}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
