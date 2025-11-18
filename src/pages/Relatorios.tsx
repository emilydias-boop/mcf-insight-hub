import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { Download, FileText, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const relatorioData = [
  { mes: "Jan", receita: 180000, custo: 120000, lucro: 60000 },
  { mes: "Fev", receita: 195000, custo: 128000, lucro: 67000 },
  { mes: "Mar", receita: 210000, custo: 135000, lucro: 75000 },
];

export default function Relatorios() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Relatórios consolidados e exportação de dados</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Configurar Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <Select defaultValue="mensal">
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Relatório Mensal</SelectItem>
                <SelectItem value="trimestral">Relatório Trimestral</SelectItem>
                <SelectItem value="anual">Relatório Anual</SelectItem>
                <SelectItem value="customizado">Customizado</SelectItem>
              </SelectContent>
            </Select>
            <DatePickerCustom mode="range" placeholder="Período" />
          </div>

          <div className="flex gap-3">
            <Button onClick={() => toast({ title: "Exportando PDF", description: "Seu relatório está sendo gerado" })}>
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            <Button variant="outline" onClick={() => toast({ title: "Exportando Excel", description: "Gerando planilha Excel" })}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={() => toast({ title: "Enviando email", description: "Relatório será enviado em breve" })}>
              <Mail className="h-4 w-4 mr-2" />
              Enviar por Email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Preview - Resumo Executivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none mb-6">
            <h3 className="text-lg font-semibold text-foreground">Relatório Mensal - Janeiro 2024</h3>
            <p className="text-sm text-muted-foreground">
              Este relatório consolida os principais indicadores de desempenho da MCF no período selecionado, 
              incluindo análise de receitas, custos, lucratividade e performance por canal de vendas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 border border-border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Faturamento Total</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(180000)}</p>
            </div>
            <div className="p-4 border border-border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Custo Total</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(120000)}</p>
            </div>
            <div className="p-4 border border-border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Lucro Operacional</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(60000)}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={relatorioData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Legend />
              <Bar dataKey="receita" fill="hsl(var(--success))" name="Receita" />
              <Bar dataKey="custo" fill="hsl(var(--destructive))" name="Custo" />
              <Bar dataKey="lucro" fill="hsl(var(--primary))" name="Lucro" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
