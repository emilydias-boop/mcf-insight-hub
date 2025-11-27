import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { SemanaMes } from "@/data/mockData";
import { useWeeklyResumo } from "@/hooks/useWeeklyMetrics";
import { startOfMonth, endOfMonth } from "date-fns";

interface ResumoFinanceiroProps {
  dados: SemanaMes[];
  periodoTipo?: 'semana' | 'mes';
  canal?: string;
}

export function ResumoFinanceiro({ dados, periodoTipo = 'semana', canal }: ResumoFinanceiroProps) {
  const [modo, setModo] = useState<'semanas' | 'mes'>(periodoTipo === 'mes' ? 'mes' : 'semanas');

  // Sincronizar quando periodoTipo mudar
  useEffect(() => {
    setModo(periodoTipo === 'mes' ? 'mes' : 'semanas');
  }, [periodoTipo]);

  // Calcular período do mês a partir dos dados
  const obterPeriodoMes = () => {
    if (!dados[0]?.dataInicio) return { inicio: undefined, fim: undefined };
    const [dia, mes, ano] = dados[0].dataInicio.split('/');
    const dataRef = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    return {
      inicio: startOfMonth(dataRef),
      fim: endOfMonth(dataRef),
    };
  };

  const periodoMes = obterPeriodoMes();

  // Buscar dados do mês completo quando modo === 'mes'
  const { data: dadosMesCompleto, isLoading: loadingMes } = useWeeklyResumo(
    undefined, // sem limit
    periodoMes.inicio,
    periodoMes.fim,
    canal
  );

  const calcularTotal = (campo: keyof Omit<SemanaMes, 'dataInicio' | 'dataFim'>) => {
    return dados.reduce((acc, item) => acc + item[campo], 0);
  };

  // Função para obter primeiro e último dia do mês a partir de uma data DD/MM/YYYY
  const obterPrimeiroUltimoDiaMes = (dataStr: string) => {
    const [dia, mes, ano] = dataStr.split('/');
    const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    return {
      primeiro: `01/${mes}/${ano}`,
      ultimo: `${ultimoDia}/${mes}/${ano}`
    };
  };

  // Usar dados corretos baseado no modo
  const dadosMes = modo === 'mes' && dadosMesCompleto ? [{
    dataInicio: dados[0]?.dataInicio ? obterPrimeiroUltimoDiaMes(dados[0].dataInicio).primeiro : '',
    dataFim: dados[0]?.dataInicio ? obterPrimeiroUltimoDiaMes(dados[0].dataInicio).ultimo : '',
    faturamentoA010: dadosMesCompleto.reduce((acc, item) => acc + item.faturamentoA010, 0),
    vendasA010: dadosMesCompleto.reduce((acc, item) => acc + item.vendasA010, 0),
    valorVendidoOBEvento: dadosMesCompleto.reduce((acc, item) => acc + item.valorVendidoOBEvento, 0),
    vendasOBEvento: dadosMesCompleto.reduce((acc, item) => acc + item.vendasOBEvento, 0),
    faturamentoContrato: dadosMesCompleto.reduce((acc, item) => acc + item.faturamentoContrato, 0),
    vendasContratos: dadosMesCompleto.reduce((acc, item) => acc + item.vendasContratos, 0),
    faturamentoOBConstruir: dadosMesCompleto.reduce((acc, item) => acc + item.faturamentoOBConstruir, 0),
    vendasOBConstruir: dadosMesCompleto.reduce((acc, item) => acc + item.vendasOBConstruir, 0),
    faturamentoOBVitalicio: dadosMesCompleto.reduce((acc, item) => acc + item.faturamentoOBVitalicio, 0),
    vendasOBVitalicio: dadosMesCompleto.reduce((acc, item) => acc + item.vendasOBVitalicio, 0),
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
        {modo === 'mes' && loadingMes ? (
          <div className="text-center text-muted-foreground py-8">Carregando dados do mês...</div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
