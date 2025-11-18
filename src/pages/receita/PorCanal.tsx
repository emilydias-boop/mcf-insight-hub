import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_CANAIS_RECEITA } from "@/data/mockData";
import { formatCurrency } from "@/lib/formatters";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = ['hsl(var(--success))', 'hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function ReceitaPorCanal() {
  const chartData = MOCK_CANAIS_RECEITA.map(canal => ({
    name: canal.canal,
    value: canal.receita
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Análise por Canal</h2>
        <p className="text-muted-foreground mt-1">Comparativo detalhado entre canais de receita</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Distribuição de Receita</CardTitle>
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
                  fill="hsl(var(--success))"
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
            <CardTitle className="text-foreground">Ranking de Canais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_CANAIS_RECEITA.map((canal, idx) => (
                <div key={canal.canal} className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold text-foreground">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-foreground">{canal.canal}</span>
                      <span className="text-sm font-bold text-success">{formatCurrency(canal.receita)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-success h-2 rounded-full" 
                        style={{ width: `${canal.percentual}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{canal.percentual}% do total</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_CANAIS_RECEITA.map((canal, idx) => (
          <Card key={canal.canal} className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                {canal.canal}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-bold text-success">{formatCurrency(canal.receita)}</p>
                  <p className="text-xs text-muted-foreground">Receita Total</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{canal.percentual}%</p>
                    <p className="text-xs text-muted-foreground">Participação</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{canal.transacoes}</p>
                    <p className="text-xs text-muted-foreground">Transações</p>
                  </div>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(canal.ticketMedio)}</p>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
