import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_KPIS, MOCK_FUNIL_A010, MOCK_FUNIL_INSTAGRAM, MOCK_SEMANAS_DETALHADO, MOCK_ULTRAMETA } from "@/data/mockData";
import { DollarSign, TrendingDown, TrendingUp, Percent, Target, Megaphone, Users, AlertTriangle } from "lucide-react";
import { DatePickerCustom } from "@/components/ui/DatePickerCustom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FunilLista } from "@/components/dashboard/FunilLista";
import { ResumoFinanceiro } from "@/components/dashboard/ResumoFinanceiro";
import { UltrametaCard } from "@/components/dashboard/UltrametaCard";

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

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral dos principais indicadores de desempenho</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {MOCK_KPIS.slice(0, 3).map((kpi) => {
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
        <UltrametaCard data={MOCK_ULTRAMETA} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {MOCK_KPIS.slice(3).map((kpi) => {
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
          <CardContent>
            <FunilLista titulo="Funil A010" etapas={MOCK_FUNIL_A010} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Funil Instagram</CardTitle>
          </CardHeader>
          <CardContent>
            <FunilLista titulo="Funil Instagram" etapas={MOCK_FUNIL_INSTAGRAM} />
          </CardContent>
        </Card>
      </div>

      <ResumoFinanceiro dados={MOCK_SEMANAS_DETALHADO} />
    </div>
  );
}
