import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { EvolutionData } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

interface TrendChartProps {
  data: EvolutionData[];
  title?: string;
}

export function TrendChart({ data, title = "Evolução Temporal" }: TrendChartProps) {
  const [weeksToShow, setWeeksToShow] = useState<12 | 26 | 52>(12);

  const displayData = data.slice(-weeksToShow);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' && entry.dataKey.includes('roi') || entry.dataKey.includes('roas')
              ? `${entry.value.toFixed(1)}x`
              : formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={weeksToShow === 12 ? "default" : "outline"}
              size="sm"
              onClick={() => setWeeksToShow(12)}
            >
              12 Semanas
            </Button>
            <Button
              variant={weeksToShow === 26 ? "default" : "outline"}
              size="sm"
              onClick={() => setWeeksToShow(26)}
            >
              26 Semanas
            </Button>
            <Button
              variant={weeksToShow === 52 ? "default" : "outline"}
              size="sm"
              onClick={() => setWeeksToShow(52)}
            >
              52 Semanas
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="faturamento">
          <TabsList className="mb-4">
            <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
            <TabsTrigger value="lucro">Lucro</TabsTrigger>
            <TabsTrigger value="roi">ROI</TabsTrigger>
            <TabsTrigger value="roas">ROAS</TabsTrigger>
          </TabsList>

          <TabsContent value="faturamento">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="semanaLabel" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="faturamento" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  name="Faturamento"
                  dot={{ fill: 'hsl(var(--success))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="custos">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="semanaLabel" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="custos" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  name="Custos"
                  dot={{ fill: 'hsl(var(--destructive))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="lucro">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="semanaLabel" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="lucro" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Lucro"
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="roi">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="semanaLabel" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${value.toFixed(1)}x`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="roi" 
                  stroke="hsl(var(--warning))" 
                  strokeWidth={2}
                  name="ROI"
                  dot={{ fill: 'hsl(var(--warning))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="roas">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="semanaLabel" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${value.toFixed(1)}x`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="roas" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={2}
                  name="ROAS"
                  dot={{ fill: 'hsl(var(--accent))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
