import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_KPIS, MOCK_FUNIL_A010, MOCK_FUNIL_INSTAGRAM, MOCK_SEMANAS } from "@/data/mockData";
import { DollarSign, TrendingDown, TrendingUp, Percent, Target, Megaphone, Users, AlertTriangle, ArrowDown } from "lucide-react";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const iconMap = {
  '1': DollarSign,
  '2': TrendingDown,
  '3': TrendingUp,
  '4': Percent,
  '5': Target,
  '6': Megaphone,
  '7': Users,
  '8': AlertTriangle,
};

function FunilEtapa({ etapa, leads, conversao, meta, isLast }: any) {
  const isAboveMeta = conversao >= meta;
  
  return (
    <div className="flex flex-col items-center">
      <Card className={cn(
        "w-full border-2 transition-colors",
        isAboveMeta ? "border-success bg-success/5" : "border-destructive bg-destructive/5"
      )}>
        <CardContent className="p-4 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-1">{etapa}</p>
          <p className="text-2xl font-bold text-foreground">{leads}</p>
          <p className={cn(
            "text-xs font-medium mt-1",
            isAboveMeta ? "text-success" : "text-destructive"
          )}>
            {conversao}% (meta: {meta}%)
          </p>
        </CardContent>
      </Card>
      {!isLast && (
        <ArrowDown className="h-6 w-6 text-muted-foreground my-2" />
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Executivo</h1>
          <p className="text-muted-foreground mt-1">Visão consolidada de todos os indicadores</p>
        </div>
        <div className="flex gap-4">
          <DatePickerCustom mode="range" placeholder="Selecione o período" />
          <Select defaultValue="todos">
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os canais</SelectItem>
              <SelectItem value="a010">A010</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="contratos">Contratos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {MOCK_KPIS.map((kpi) => {
          const Icon = iconMap[kpi.id as keyof typeof iconMap];
          return (
            <KPICard
              key={kpi.id}
              title={kpi.title}
              value={kpi.value}
              change={kpi.change}
              icon={Icon}
              variant={kpi.variant}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Funil A010</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {MOCK_FUNIL_A010.map((etapa, idx) => (
              <FunilEtapa 
                key={etapa.etapa} 
                {...etapa} 
                isLast={idx === MOCK_FUNIL_A010.length - 1}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Funil Instagram</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {MOCK_FUNIL_INSTAGRAM.map((etapa, idx) => (
              <FunilEtapa 
                key={etapa.etapa} 
                {...etapa} 
                isLast={idx === MOCK_FUNIL_INSTAGRAM.length - 1}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Resumo Semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Período</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">A010</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Contratos</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Custos</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Lucro</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">ROI</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_SEMANAS.map((semana) => (
                  <tr key={semana.semana} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm text-foreground">{semana.semana}</td>
                    <td className="py-3 px-4 text-sm text-right text-foreground">{formatCurrency(semana.a010)}</td>
                    <td className="py-3 px-4 text-sm text-right text-foreground">{formatCurrency(semana.contratos)}</td>
                    <td className="py-3 px-4 text-sm text-right text-foreground">{formatCurrency(semana.custos)}</td>
                    <td className={cn(
                      "py-3 px-4 text-sm text-right font-medium",
                      semana.lucro >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(semana.lucro)}
                    </td>
                    <td className={cn(
                      "py-3 px-4 text-sm text-right font-medium",
                      semana.roi >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatPercent(semana.roi)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-bold">
                  <td className="py-3 px-4 text-sm text-foreground">Total</td>
                  <td className="py-3 px-4 text-sm text-right text-foreground">
                    {formatCurrency(MOCK_SEMANAS.reduce((sum, s) => sum + s.a010, 0))}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-foreground">
                    {formatCurrency(MOCK_SEMANAS.reduce((sum, s) => sum + s.contratos, 0))}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-foreground">
                    {formatCurrency(MOCK_SEMANAS.reduce((sum, s) => sum + s.custos, 0))}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-destructive">
                    {formatCurrency(MOCK_SEMANAS.reduce((sum, s) => sum + s.lucro, 0))}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-destructive">
                    {formatPercent(MOCK_SEMANAS.reduce((sum, s) => sum + s.roi, 0) / MOCK_SEMANAS.length)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
