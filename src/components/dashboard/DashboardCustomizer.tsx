import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Settings, TrendingUp, Target, Filter, Instagram, DollarSign, LineChart, Bell, GitCompare } from "lucide-react";
import { DashboardWidget } from "@/types/dashboard";
import { useDashboardPreferences } from "@/hooks/useDashboardPreferences";
import { DASHBOARD_TEMPLATES } from "@/lib/dashboardTemplates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AVAILABLE_WIDGETS: Array<{
  id: DashboardWidget;
  name: string;
  description: string;
  icon: React.ElementType;
}> = [
  { id: 'kpis', name: 'Indicadores Principais (KPIs)', description: 'Métricas essenciais do negócio', icon: TrendingUp },
  { id: 'ultrameta', name: 'Ultrameta Clint', description: 'Meta principal e faturamentos', icon: Target },
  { id: 'funil-a010', name: 'Funil A010', description: 'Conversão do funil A010', icon: Filter },
  { id: 'funil-instagram', name: 'Funil Instagram', description: 'Conversão do funil Instagram', icon: Instagram },
  { id: 'resumo-financeiro', name: 'Resumo Financeiro Semanal', description: 'Detalhamento semanal de vendas', icon: DollarSign },
  { id: 'grafico-evolucao', name: 'Gráfico de Evolução', description: 'Tendências temporais de KPIs', icon: LineChart },
  { id: 'alertas-recentes', name: 'Alertas Recentes', description: 'Últimos alertas do sistema', icon: Bell },
  { id: 'comparacao-periodos', name: 'Comparação de Períodos', description: 'Compare métricas entre períodos', icon: GitCompare },
];

export function DashboardCustomizer() {
  const { preferences, updatePreferences, isUpdating } = useDashboardPreferences();
  const [open, setOpen] = useState(false);
  const [selectedWidgets, setSelectedWidgets] = useState<DashboardWidget[]>([]);

  // Sincronizar estado quando preferences carrega
  useEffect(() => {
    if (preferences?.visible_widgets) {
      setSelectedWidgets(preferences.visible_widgets);
    } else {
      setSelectedWidgets(DASHBOARD_TEMPLATES.completo.widgets);
    }
  }, [preferences?.visible_widgets]);

  const handleToggleWidget = (widgetId: DashboardWidget) => {
    setSelectedWidgets(prev =>
      prev.includes(widgetId)
        ? prev.filter(id => id !== widgetId)
        : [...prev, widgetId]
    );
  };

  const handleApplyTemplate = (templateKey: string) => {
    const template = DASHBOARD_TEMPLATES[templateKey];
    setSelectedWidgets(template.widgets);
  };

  const handleSave = () => {
    updatePreferences({
      visible_widgets: selectedWidgets,
      widgets_order: selectedWidgets,
    });
    setOpen(false);
  };

  const handleReset = () => {
    const defaultWidgets = DASHBOARD_TEMPLATES.completo.widgets;
    setSelectedWidgets(defaultWidgets);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Personalizar Dashboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col !grid-cols-none">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Personalizar Dashboard</DialogTitle>
          <DialogDescription>
            Escolha quais widgets você deseja visualizar no seu dashboard ou aplique um template pré-configurado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <div className="space-y-6 pb-6">
            {/* Templates Section */}
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold mb-1">Templates Rápidos</h3>
                <p className="text-sm text-muted-foreground">Aplique configurações pré-definidas</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(DASHBOARD_TEMPLATES).map(([key, template]) => (
                  <Card
                    key={key}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleApplyTemplate(key)}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                      <CardDescription className="text-xs">{template.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            <Separator />

            {/* Widgets Section */}
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold mb-1">Widgets Disponíveis</h3>
                <p className="text-sm text-muted-foreground">Selecione os widgets que deseja exibir</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {AVAILABLE_WIDGETS.map((widget) => {
                  const Icon = widget.icon;
                  return (
                    <Card
                      key={widget.id}
                      className="cursor-pointer transition-all hover:border-primary/50"
                      onClick={() => handleToggleWidget(widget.id)}
                    >
                      <CardHeader className="p-4">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedWidgets.includes(widget.id)}
                            onCheckedChange={() => handleToggleWidget(widget.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <CardTitle className="text-sm">{widget.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {widget.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Resetar para Padrão
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? 'Salvando...' : 'Salvar Preferências'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
