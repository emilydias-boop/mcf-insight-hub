import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOCK_CLIENTES_CREDITO } from "@/data/mockData";
import { formatCurrency } from "@/lib/formatters";
import { DollarSign, Users, TrendingDown, Award, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const kpis = [
  { title: "Crédito Concedido", value: "R$ 500.000,00", change: 15.2, icon: DollarSign, variant: "success" as const },
  { title: "Inadimplência", value: "R$ 21.000,00", change: -3.1, icon: TrendingDown, variant: "danger" as const },
  { title: "Clientes Ativos", value: "127", change: 8.5, icon: Users, variant: "success" as const },
  { title: "Score Médio", value: "720", change: 2.8, icon: Award, variant: "success" as const },
];

export default function Credito() {
  const getRiscoColor = (score: number) => {
    if (score >= 700) return "text-success";
    if (score >= 600) return "text-warning";
    return "text-destructive";
  };

  const getRiscoLabel = (score: number) => {
    if (score >= 700) return "Baixo";
    if (score >= 600) return "Médio";
    return "Alto";
  };

  return (
    <ResourceGuard resource="credito">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Crédito</h1>
          <p className="text-muted-foreground mt-1">Monitoramento de crédito e inadimplência</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {kpis.map((kpi, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">{kpi.title}</p>
                <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-success/10 border-success/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">Risco Baixo</p>
              <p className="text-3xl font-bold text-success">128</p>
              <p className="text-xs text-muted-foreground mt-1">Score &gt; 700</p>
            </CardContent>
          </Card>

          <Card className="bg-warning/10 border-warning/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">Risco Médio</p>
              <p className="text-3xl font-bold text-warning">45</p>
              <p className="text-xs text-muted-foreground mt-1">Score 500-700</p>
            </CardContent>
          </Card>

          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2">Risco Alto</p>
              <p className="text-3xl font-bold text-destructive">12</p>
              <p className="text-xs text-muted-foreground mt-1">Score &lt; 500</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Clientes Inadimplentes</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">CPF</TableHead>
                  <TableHead className="text-muted-foreground">Valor Devido</TableHead>
                  <TableHead className="text-muted-foreground">Dias em Atraso</TableHead>
                  <TableHead className="text-muted-foreground">Score</TableHead>
                  <TableHead className="text-muted-foreground">Risco</TableHead>
                  <TableHead className="text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_CLIENTES_CREDITO.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="font-medium text-foreground">{cliente.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{cliente.cpf}</TableCell>
                    <TableCell className="text-destructive font-semibold">{formatCurrency(cliente.valorDevido)}</TableCell>
                    <TableCell className="text-muted-foreground">{cliente.diasAtraso} dias</TableCell>
                    <TableCell className="text-foreground">{cliente.score}</TableCell>
                    <TableCell>
                      <Badge variant={getRiscoColor(cliente.score) as any}>
                        {getRiscoLabel(cliente.score)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => toast({ title: "Contato iniciado", description: `Tentando contato com ${cliente.nome}` })}
                      >
                        <Phone className="h-3 w-3 mr-1" />
                        Contatar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ResourceGuard>
  );
}
