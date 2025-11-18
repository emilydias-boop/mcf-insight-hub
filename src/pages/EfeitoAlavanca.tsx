import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MOCK_CANAIS_RECEITA } from "@/data/mockData";
import { formatCurrency } from "@/lib/formatters";
import { Calculator, TrendingUp, Lightbulb } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const roiData = MOCK_CANAIS_RECEITA.map(canal => ({
  canal: canal.canal,
  roi: ((canal.receita / (canal.receita * 0.6)) - 1) * 100
})).sort((a, b) => b.roi - a.roi);

export default function EfeitoAlavanca() {
  const [investimento, setInvestimento] = useState("10000");
  const [canalSelecionado, setCanalSelecionado] = useState("A010");

  const calcularRetorno = () => {
    const valor = parseFloat(investimento);
    const roasCanal = canalSelecionado === 'A010' ? 4.2 : canalSelecionado === 'Instagram' ? 3.5 : 3.8;
    const receitaEstimada = valor * roasCanal;
    const roiProjetado = ((receitaEstimada - valor) / valor) * 100;
    const tempoRetorno = Math.ceil((valor / receitaEstimada) * 30);

    return {
      receitaEstimada,
      roiProjetado,
      roasEsperado: roasCanal,
      tempoRetorno
    };
  };

  const resultado = calcularRetorno();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Efeito Alavanca</h1>
        <p className="text-muted-foreground mt-1">Análise de ROI e simulação de investimentos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Simulador de Investimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="investimento">Valor a Investir</Label>
              <Input
                id="investimento"
                type="number"
                value={investimento}
                onChange={(e) => setInvestimento(e.target.value)}
                placeholder="10000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="canal">Canal</Label>
              <Select value={canalSelecionado} onValueChange={setCanalSelecionado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A010">A010</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Contratos">Contratos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 space-y-4 border-t border-border">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Investimento</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(parseFloat(investimento))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">ROAS Esperado</span>
                <span className="text-sm font-bold text-primary">{resultado.roasEsperado}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Receita Estimada</span>
                <span className="text-sm font-bold text-success">{formatCurrency(resultado.receitaEstimada)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">ROI Projetado</span>
                <span className="text-sm font-bold text-success">+{resultado.roiProjetado.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Tempo de Retorno</span>
                <span className="text-sm font-bold text-foreground">{resultado.tempoRetorno} dias</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              ROI Histórico por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roiData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                <YAxis dataKey="canal" type="category" stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: any) => `${value.toFixed(1)}%`}
                />
                <Bar dataKey="roi" fill="hsl(var(--success))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Recomendações Estratégicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <h4 className="font-semibold text-success mb-2">💡 Oportunidade: Investir no Instagram</h4>
              <p className="text-sm text-muted-foreground">
                Investir R$ 10.000 no Instagram pode gerar aproximadamente R$ 35.000 em receita (ROAS 3.5x), 
                com retorno do investimento em 9 dias. Canal com alta taxa de conversão e público engajado.
              </p>
            </div>

            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <h4 className="font-semibold text-success mb-2">⚡ Alta Performance: Canal A010</h4>
              <p className="text-sm text-muted-foreground">
                A010 apresenta o melhor ROAS (4.2x) e maior ticket médio (R$ 4.200). 
                Recomenda-se aumentar investimentos neste canal para maximizar lucros no curto prazo.
              </p>
            </div>

            <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <h4 className="font-semibold text-warning mb-2">⚠️ Atenção: OB Vitalício</h4>
              <p className="text-sm text-muted-foreground">
                Canal com menor receita (R$ 5.760) e ticket médio baixo (R$ 480). 
                Considere otimizar estratégia de marketing ou realocar recursos para canais de maior retorno.
              </p>
            </div>

            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <h4 className="font-semibold text-primary mb-2">📊 Diversificação: Contratos</h4>
              <p className="text-sm text-muted-foreground">
                Canal Contratos representa 21.1% da receita total com alto ticket médio (R$ 6.300). 
                Expandir parcerias estratégicas pode aumentar receita sem aumentar custos de marketing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
