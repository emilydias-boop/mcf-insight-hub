import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Gestão de Crédito</h1>
        <p className="text-muted-foreground mt-1">Análise de crédito e controle de inadimplência</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => (
          <KPICard key={idx} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-2xl font-bold text-success">60%</p>
            <p className="text-sm text-muted-foreground">Baixo Risco</p>
          </CardContent>
        </Card>

        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <p className="text-2xl font-bold text-warning">30%</p>
            <p className="text-sm text-muted-foreground">Médio Risco</p>
          </CardContent>
        </Card>

        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-2">🚨</div>
            <p className="text-2xl font-bold text-destructive">10%</p>
            <p className="text-sm text-muted-foreground">Alto Risco</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Clientes Inadimplentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nome</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">CPF</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor Devido</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Dias Atraso</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Score</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Risco</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_CLIENTES_CREDITO.map((cliente) => (
                  <tr key={cliente.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm text-foreground">{cliente.nome}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{cliente.cpf}</td>
                    <td className="py-3 px-4 text-sm text-right font-medium text-destructive">
                      {formatCurrency(cliente.valorDevido)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={cliente.diasAtraso > 45 ? 'destructive' : 'default'}>
                        {cliente.diasAtraso} dias
                      </Badge>
                    </td>
                    <td className={cn("py-3 px-4 text-sm text-center font-medium", getRiscoColor(cliente.score))}>
                      {cliente.score}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn("text-xs font-medium", getRiscoColor(cliente.score))}>
                        {getRiscoLabel(cliente.score)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => toast({ title: "Contato", description: `Entrando em contato com ${cliente.nome}` })}
                      >
                        <Phone className="h-3 w-3 mr-1" />
                        Contatar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
