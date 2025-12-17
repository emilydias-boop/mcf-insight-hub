import { useState } from "react";
import { DollarSign, TrendingUp, Calendar, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMyEmployeeNfse } from "@/hooks/useMyEmployee";
import { NFSE_STATUS_LABELS, NFSE_PAGAMENTO_LABELS } from "@/types/hr";
import type { Employee } from "@/types/hr";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MeuRHRemuneracaoTabProps {
  employee: Employee;
}

export function MeuRHRemuneracaoTab({ employee }: MeuRHRemuneracaoTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const { data: nfseList, isLoading } = useMyEmployeeNfse(employee.id);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Gerar últimos 12 meses para o select
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(startOfMonth(new Date()), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    };
  });

  // Encontrar NFSe do mês selecionado
  const [year, month] = selectedMonth.split('-').map(Number);
  const currentNfse = nfseList?.find(n => n.ano === year && n.mes === month);

  // Calcular valores
  const fixo = employee.salario_base || 0;
  const ote = employee.ote_mensal || 0;
  const variavel = ote > fixo ? ote - fixo : 0;

  // Histórico dos últimos 6 meses
  const last6Months = monthOptions.slice(0, 6).map(m => {
    const [y, mo] = m.value.split('-').map(Number);
    const nfse = nfseList?.find(n => n.ano === y && n.mes === mo);
    return {
      month: m.label,
      total: ote,
      nfseEnviada: nfse?.status_nfse === 'nota_enviada',
      dataPagamento: nfse?.data_pagamento,
      statusPagamento: nfse?.status_pagamento,
    };
  });

  return (
    <div className="space-y-4">
      {/* Filtro de mês */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Card resumido do mês */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Resumo do Mês
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">OTE</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(ote)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Fixo</p>
              <p className="text-sm font-semibold">{formatCurrency(fixo)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Variável</p>
              <p className="text-sm font-semibold">{formatCurrency(variavel)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Total Previsto</p>
              <p className="text-sm font-semibold">{formatCurrency(ote)}</p>
            </div>
            {employee.tipo_contrato === 'PJ' && (
              <div>
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Status NFSe</p>
                {currentNfse ? (
                  <Badge className={`${NFSE_STATUS_LABELS[currentNfse.status_nfse].color} text-white text-[10px] mt-1`}>
                    {NFSE_STATUS_LABELS[currentNfse.status_nfse].label}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] mt-1">Não enviada</Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Histórico (últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Mês</TableHead>
                  <TableHead className="text-xs">Total Previsto</TableHead>
                  {employee.tipo_contrato === 'PJ' && (
                    <TableHead className="text-xs">NFSe Enviada</TableHead>
                  )}
                  <TableHead className="text-xs">Data Pagamento</TableHead>
                  <TableHead className="text-xs">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {last6Months.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs capitalize">{row.month}</TableCell>
                    <TableCell className="text-xs">{formatCurrency(row.total)}</TableCell>
                    {employee.tipo_contrato === 'PJ' && (
                      <TableCell className="text-xs">
                        {row.nfseEnviada ? (
                          <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Não</Badge>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-xs">
                      {row.dataPagamento ? format(new Date(row.dataPagamento), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.statusPagamento ? (
                        <Badge className={`${NFSE_PAGAMENTO_LABELS[row.statusPagamento].color} text-white text-[10px]`}>
                          {NFSE_PAGAMENTO_LABELS[row.statusPagamento].label}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">-</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground/70">
        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
        <p>Os valores exibidos são previsões baseadas no seu plano de remuneração. 
           O valor final pode variar conforme desempenho e ajustes aprovados pelo RH.</p>
      </div>
    </div>
  );
}
