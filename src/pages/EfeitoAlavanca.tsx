import { useState } from "react";
import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MOCK_CANAIS_RECEITA } from "@/data/mockData";
import { formatCurrency } from "@/lib/formatters";
import { Calculator, TrendingUp, Lightbulb, Target, AlertCircle, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const roiData = MOCK_CANAIS_RECEITA.map(canal => ({
  canal: canal.canal,
  roi: ((canal.receita / (canal.receita * 0.6)) - 1) * 100
})).sort((a, b) => b.roi - a.roi);

export default function EfeitoAlavanca() {
  const [investimento, setInvestimento] = useState(10000);
  const [canalSelecionado, setCanalSelecionado] = useState("A010");

  const calcularRetorno = () => {
    const valor = investimento;
    const roasCanal = canalSelecionado === 'A010' ? 4.2 : canalSelecionado === 'Instagram' ? 3.5 : 3.8;
    const receitaEstimada = valor * roasCanal;
    const roi = ((receitaEstimada - valor) / valor) * 100;
    const roas = roasCanal;
    const paybackMeses = Math.ceil((valor / receitaEstimada) * 30);

    return {
      receitaEstimada,
      roi,
      roas,
      paybackMeses
    };
  };

  const resultado = calcularRetorno();

  return (
    <ResourceGuard resource="efeito_alavanca">
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Efeito Alavanca</h1>
          <p className="text-sm text-muted-foreground mt-1 hidden sm:block">Simulação de investimentos e ROI por canal</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base text-foreground">Simulador de Investimento</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-foreground">Valor do Investimento (R$)</label>
                <Input 
                  type="number" 
                  value={investimento} 
                  onChange={(e) => setInvestimento(Number(e.target.value))}
                  placeholder="Ex: 50000"
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-foreground">Canal</label>
                <Select value={canalSelecionado} onValueChange={setCanalSelecionado}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_CANAIS_RECEITA.map(canal => (
                      <SelectItem key={canal.canal} value={canal.canal}>{canal.canal}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <div className="p-2 sm:p-4 border border-border rounded-lg">
                <p className="text-[10px] sm:text-sm text-muted-foreground mb-1">Receita Estimada</p>
                <p className="text-base sm:text-2xl font-bold text-success">{formatCurrency(resultado.receitaEstimada)}</p>
              </div>
              <div className="p-2 sm:p-4 border border-border rounded-lg">
                <p className="text-[10px] sm:text-sm text-muted-foreground mb-1">ROI Projetado</p>
                <p className="text-base sm:text-2xl font-bold text-primary">{resultado.roi.toFixed(2)}%</p>
              </div>
              <div className="p-2 sm:p-4 border border-border rounded-lg">
                <p className="text-[10px] sm:text-sm text-muted-foreground mb-1">ROAS</p>
                <p className="text-base sm:text-2xl font-bold text-info">{resultado.roas.toFixed(2)}x</p>
              </div>
              <div className="p-2 sm:p-4 border border-border rounded-lg">
                <p className="text-[10px] sm:text-sm text-muted-foreground mb-1">Payback (meses)</p>
                <p className="text-base sm:text-2xl font-bold text-foreground">{resultado.paybackMeses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base text-foreground">ROI Histórico por Canal</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <ResponsiveContainer width="100%" height={300} className="sm:!h-[400px]">
              <BarChart data={roiData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis dataKey="canal" type="category" stroke="hsl(var(--muted-foreground))" width={80} tick={{ fontSize: 10 }} className="sm:!w-[150px]" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => `${value.toFixed(2)}%`}
                />
                <Bar dataKey="roi" fill="hsl(var(--primary))" name="ROI (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Recomendações Estratégicas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
                <TrendingUp className="h-5 w-5 text-success mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Oportunidades de Crescimento</h4>
                  <p className="text-sm text-muted-foreground">
                    Com base no ROI atual de {resultado.roi.toFixed(2)}%, considere aumentar investimento em {canalSelecionado} 
                    para maximizar retornos. O payback estimado é de {resultado.paybackMeses} meses.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
                <Target className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Canais de Alto Desempenho</h4>
                  <p className="text-sm text-muted-foreground">
                    {roiData.slice(0, 2).map(c => c.canal).join(' e ')} apresentam os melhores ROIs históricos. 
                    Mantenha ou aumente investimentos nesses canais.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Pontos de Atenção</h4>
                  <p className="text-sm text-muted-foreground">
                    {roiData.slice(-2).map(c => c.canal).join(' e ')} apresentam ROI abaixo da média. 
                    Revise estratégias ou considere realocar orçamento.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
                <PieChart className="h-5 w-5 text-info mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Diversificação</h4>
                  <p className="text-sm text-muted-foreground">
                    Mantenha um portfólio diversificado de canais para mitigar riscos. O investimento total recomendado 
                    considera a proporção histórica de performance.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResourceGuard>
  );
}
