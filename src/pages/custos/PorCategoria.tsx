import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_CATEGORIAS_CUSTO } from "@/data/mockData";
import { formatCurrency } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--muted))', 'hsl(var(--primary))'];

export default function CustosPorCategoria() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Análise por Categoria</h2>
        <p className="text-muted-foreground mt-1">Comparativo detalhado entre categorias de custo</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Comparativo de Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={MOCK_CATEGORIAS_CUSTO}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="categoria" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Legend />
              <Bar dataKey="valor" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_CATEGORIAS_CUSTO.map((cat, idx) => (
          <Card key={cat.categoria} className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                {cat.categoria}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(cat.valor)}</p>
                  <p className="text-xs text-muted-foreground">Custo Total</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{cat.percentual}%</p>
                    <p className="text-xs text-muted-foreground">Do Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground capitalize">{cat.tipo}</p>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-destructive h-2 rounded-full" 
                    style={{ width: `${cat.percentual}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
