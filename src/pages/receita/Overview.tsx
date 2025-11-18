import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_CANAIS_RECEITA } from "@/data/mockData";
import { DollarSign, TrendingUp, ShoppingCart, BarChart3 } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const kpis = [
  { title: "Receita Total", value: "R$ 180.000,00", change: 12.5, icon: DollarSign, variant: "success" as const },
  { title: "Ticket Médio", value: "R$ 3.500,00", change: 5.2, icon: TrendingUp, variant: "success" as const },
  { title: "Transações", value: "51", change: 8.0, icon: ShoppingCart, variant: "success" as const },
  { title: "Crescimento", value: "+12.5%", change: 12.5, icon: BarChart3, variant: "success" as const },
];

const evolucaoData = [
  { semana: "Sem 1", A010: 15000, Instagram: 8000, Contratos: 9000 },
  { semana: "Sem 2", A010: 18000, Instagram: 9500, Contratos: 12000 },
  { semana: "Sem 3", A010: 16500, Instagram: 10500, Contratos: 9500 },
  { semana: "Sem 4", A010: 17820, Instagram: 12140, Contratos: 7480 },
];

export default function ReceitaOverview() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Visão Geral de Receita</h2>
        <p className="text-muted-foreground mt-1">Análise consolidada de receitas por canal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => (
          <KPICard key={idx} {...kpi} />
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Evolução de Receita por Canal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolucaoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="semana" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line type="monotone" dataKey="A010" stroke="hsl(var(--success))" strokeWidth={2} />
              <Line type="monotone" dataKey="Instagram" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="Contratos" stroke="hsl(var(--warning))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Top Canais de Receita</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={MOCK_CANAIS_RECEITA} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="canal" type="category" stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Bar dataKey="receita" fill="hsl(var(--success))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_CANAIS_RECEITA.map((canal) => (
          <Card key={canal.canal} className="bg-card border-border">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">{canal.canal}</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Receita</span>
                  <span className="text-sm font-medium text-foreground">{formatCurrency(canal.receita)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">% do Total</span>
                  <span className="text-sm font-medium text-foreground">{canal.percentual}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Ticket Médio</span>
                  <span className="text-sm font-medium text-foreground">{formatCurrency(canal.ticketMedio)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transações</span>
                  <span className="text-sm font-medium text-foreground">{canal.transacoes}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
