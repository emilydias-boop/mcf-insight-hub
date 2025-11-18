import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [selectedWidgets, setSelectedWidgets] = useState<DashboardWidget[]>(
    preferences?.visible_widgets || []
  );

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
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Personalizar Dashboard</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Templates */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Templates Pré-definidos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(DASHBOARD_TEMPLATES).map(([key, template]) => (
                <Card 
                  key={key}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleApplyTemplate(key)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{template.name}</CardTitle>
                    <CardDescription className="text-xs">{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {template.widgets.length} widgets
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          {/* Widgets Disponíveis */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Widgets Disponíveis</h3>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {AVAILABLE_WIDGETS.map((widget) => {
                  const Icon = widget.icon;
                  return (
                    <div
                      key={widget.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={widget.id}
                        checked={selectedWidgets.includes(widget.id)}
                        onCheckedChange={() => handleToggleWidget(widget.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Label
                            htmlFor={widget.id}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {widget.name}
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {widget.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-between pt-4 border-t">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
