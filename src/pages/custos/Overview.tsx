import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_CATEGORIAS_CUSTO } from "@/data/mockData";
import { TrendingDown, DollarSign, AlertCircle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const kpis = [
  { title: "Custo Total", value: "R$ 120.000,00", change: 8.2, icon: TrendingDown, variant: "danger" as const },
  { title: "Custo Fixo", value: "R$ 80.000,00", change: 2.1, icon: DollarSign, variant: "danger" as const },
  { title: "Custo Variável", value: "R$ 40.000,00", change: 18.5, icon: AlertCircle, variant: "danger" as const },
  { title: "Variação", value: "+8.2%", change: 8.2, icon: TrendingUp, variant: "danger" as const },
];

const COLORS = ['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--muted))', 'hsl(var(--primary))'];

const evolucaoData = [
  { semana: "Sem 1", total: 28000, marketing: 11200, pessoal: 9800 },
  { semana: "Sem 2", total: 30000, marketing: 12000, pessoal: 10500 },
  { semana: "Sem 3", total: 31000, marketing: 12400, pessoal: 10850 },
  { semana: "Sem 4", total: 31000, marketing: 12400, pessoal: 10850 },
];

export default function CustosOverview() {
  const chartData = MOCK_CATEGORIAS_CUSTO.map(cat => ({
    name: cat.categoria,
    value: cat.valor
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Visão Geral de Custos</h2>
        <p className="text-muted-foreground mt-1">Análise consolidada de despesas por categoria</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => (
          <KPICard key={idx} {...kpi} />
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Evolução de Custos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolucaoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="semana" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--destructive))" strokeWidth={2} name="Total" />
              <Line type="monotone" dataKey="marketing" stroke="hsl(var(--warning))" strokeWidth={2} name="Marketing" />
              <Line type="monotone" dataKey="pessoal" stroke="hsl(var(--primary))" strokeWidth={2} name="Pessoal" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.payload.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                  outerRadius={80}
                  fill="hsl(var(--destructive))"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Detalhamento por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_CATEGORIAS_CUSTO.map((cat, idx) => (
                <div key={cat.categoria} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-foreground">{cat.categoria}</span>
                    </div>
                    <span className="text-sm font-bold text-destructive">{formatCurrency(cat.valor)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-destructive h-2 rounded-full" 
                      style={{ width: `${cat.percentual}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{cat.percentual}% do total</span>
                    <span className="capitalize">{cat.tipo}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
