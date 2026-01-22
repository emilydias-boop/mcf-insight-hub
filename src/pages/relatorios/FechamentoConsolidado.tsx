import { useState } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Users, DollarSign, TrendingUp, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRelatorioConsolidado, SquadSummary } from "@/hooks/useRelatorioConsolidado";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight } from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getSquadIcon = (squad: string) => {
  switch (squad) {
    case 'incorporador': return '🏠';
    case 'consorcio': return '💳';
    case 'credito': return '💰';
    case 'projetos': return '📁';
    default: return '📊';
  }
};

const getSquadLabel = (squad: string) => {
  switch (squad) {
    case 'incorporador': return 'Incorporador';
    case 'consorcio': return 'Consórcio';
    case 'credito': return 'Crédito';
    case 'projetos': return 'Projetos';
    default: return squad;
  }
};

function SquadCard({ squad }: { squad: SquadSummary }) {
  const [isOpen, setIsOpen] = useState(false);
  const allMembers = [...squad.sdrs.members, ...squad.closers.members];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-4">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getSquadIcon(squad.squad)}</span>
                <CardTitle className="text-lg">{getSquadLabel(squad.squad).toUpperCase()}</CardTitle>
                <Badge variant="outline">{squad.totals.headcount} pessoas</Badge>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Conta</p>
                  <p className="font-bold text-lg">{formatCurrency(squad.totals.totalConta)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Ø Meta</p>
                  <p className="font-bold text-lg">{formatPercent(squad.totals.avgMetaPct)}</p>
                </div>
                {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            {/* Summary by role */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {squad.sdrs.count > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">SDRs ({squad.sdrs.count})</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Fixo:</span>
                      <span className="ml-2 font-medium">{formatCurrency(squad.sdrs.totalFixo)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Variável:</span>
                      <span className="ml-2 font-medium">{formatCurrency(squad.sdrs.totalVariavel)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span>
                      <span className="ml-2 font-medium">{formatCurrency(squad.sdrs.totalConta)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ø Meta:</span>
                      <span className="ml-2 font-medium">{formatPercent(squad.sdrs.avgMetaPct)}</span>
                    </div>
                  </div>
                </div>
              )}

              {squad.closers.count > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Closers ({squad.closers.count})</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Fixo:</span>
                      <span className="ml-2 font-medium">{formatCurrency(squad.closers.totalFixo)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Variável:</span>
                      <span className="ml-2 font-medium">{formatCurrency(squad.closers.totalVariavel)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span>
                      <span className="ml-2 font-medium">{formatCurrency(squad.closers.totalConta)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ø Meta:</span>
                      <span className="ml-2 font-medium">{formatPercent(squad.closers.avgMetaPct)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Member details */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Fixo</TableHead>
                  <TableHead className="text-right">Variável</TableHead>
                  <TableHead className="text-right">Total Conta</TableHead>
                  <TableHead className="text-right">% Meta</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.sdrName}</TableCell>
                    <TableCell>
                      <Badge variant={member.roleType === 'closer' ? 'secondary' : 'outline'}>
                        {member.roleType === 'closer' ? 'Closer' : 'SDR'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(member.fixo)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(member.variavel)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(member.totalConta)}</TableCell>
                    <TableCell className="text-right">
                      <span className={member.pctMeta >= 100 ? 'text-success' : member.pctMeta >= 80 ? 'text-warning' : 'text-destructive'}>
                        {formatPercent(member.pctMeta)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === 'approved' ? 'default' : member.status === 'locked' ? 'secondary' : 'outline'}>
                        {member.status === 'approved' ? 'Aprovado' : member.status === 'locked' ? 'Travado' : 'Rascunho'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function FechamentoConsolidado() {
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));

  // Generate last 12 months for selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    };
  });

  const { data, isLoading } = useRelatorioConsolidado(selectedMonth);

  const handleExport = () => {
    if (!data) return;

    const rows = [
      ["Squad", "Função", "Nome", "Fixo", "Variável", "Total Conta", "iFood", "Total Geral", "% Meta", "Status"],
    ];

    for (const squad of data.squads) {
      const allMembers = [...squad.sdrs.members, ...squad.closers.members];
      for (const member of allMembers) {
        rows.push([
          getSquadLabel(squad.squad),
          member.roleType === 'closer' ? 'Closer' : 'SDR',
          member.sdrName,
          member.fixo.toString(),
          member.variavel.toString(),
          member.totalConta.toString(),
          (member.ifoodMensal + member.ifoodUltrameta).toString(),
          member.totalGeral.toString(),
          member.pctMeta.toFixed(1),
          member.status,
        ]);
      }
    }

    const csvContent = rows.map((row) => row.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fechamento-consolidado-${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Relatório Consolidado de Fechamentos
          </h1>
          <p className="text-muted-foreground">Visão executiva por squad e função</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExport} disabled={!data || isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Fixo</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.grandTotals.totalFixo)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Variável</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.grandTotals.totalVariavel)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Conta</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.grandTotals.totalConta)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Headcount</p>
                  <p className="text-2xl font-bold">{data.grandTotals.headcount}</p>
                  <p className="text-sm text-muted-foreground">Ø {formatPercent(data.grandTotals.avgMetaPct)} meta</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Squad Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Por Squad / BU</h2>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : data && data.squads.length > 0 ? (
          data.squads.map((squad) => <SquadCard key={squad.squad} squad={squad} />)
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum fechamento encontrado para este mês.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
