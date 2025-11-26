import { useState } from "react";
import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MOCK_ALERTAS } from "@/data/mockData";
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const iconMap = {
  critico: AlertTriangle,
  aviso: AlertCircle,
  info: Info,
};

const variantMap = {
  critico: 'destructive',
  aviso: 'default',
  info: 'secondary',
};

export default function Alertas() {
  const [alertas, setAlertas] = useState(MOCK_ALERTAS);

  const resolverAlerta = (id: string) => {
    setAlertas(alertas.map(a => a.id === id ? { ...a, resolvido: true } : a));
    toast({ title: "Alerta resolvido", description: "O alerta foi marcado como resolvido" });
  };

  const alertasAtivos = alertas.filter(a => !a.resolvido);
  const alertasCriticos = alertasAtivos.filter(a => a.tipo === 'critico');
  const alertasWarning = alertasAtivos.filter(a => a.tipo === 'aviso');
  const alertasInfo = alertasAtivos.filter(a => a.tipo === 'info');

  const AlertaCard = ({ alerta }: any) => {
    const Icon = iconMap[alerta.tipo as keyof typeof iconMap];
    
    return (
      <Card className={cn(
        "border-l-4",
        alerta.tipo === 'critico' && "border-l-destructive bg-destructive/5",
        alerta.tipo === 'aviso' && "border-l-warning bg-warning/5",
        alerta.tipo === 'info' && "border-l-primary bg-primary/5"
      )}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className={cn(
                "p-2 rounded-lg",
                alerta.tipo === 'critico' && "bg-destructive/10",
                alerta.tipo === 'aviso' && "bg-warning/10",
                alerta.tipo === 'info' && "bg-primary/10"
              )}>
                <Icon className={cn(
                  "h-5 w-5",
                  alerta.tipo === 'critico' && "text-destructive",
                  alerta.tipo === 'aviso' && "text-warning",
                  alerta.tipo === 'info' && "text-primary"
                )} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-foreground">{alerta.titulo}</h3>
                  <Badge variant={variantMap[alerta.tipo as keyof typeof variantMap] as any}>
                    {alerta.tipo.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{alerta.descricao}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(alerta.data)}</p>
              </div>
            </div>
            {!alerta.resolvido && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => resolverAlerta(alerta.id)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Resolver
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <ResourceGuard resource="alertas">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alertas e Notificações</h1>
          <p className="text-muted-foreground mt-1">Monitoramento de eventos importantes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alertas Críticos</p>
                  <p className="text-3xl font-bold text-destructive">{alertasCriticos.length}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-warning/10 border-warning/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avisos</p>
                  <p className="text-3xl font-bold text-warning">{alertasWarning.length}</p>
                </div>
                <AlertCircle className="h-10 w-10 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-info/10 border-info/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Informativos</p>
                  <p className="text-3xl font-bold text-info">{alertasInfo.length}</p>
                </div>
                <Info className="h-10 w-10 text-info" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="todos" className="w-full">
          <TabsList className="grid w-full md:w-[400px] grid-cols-4">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="critico">Crítico</TabsTrigger>
            <TabsTrigger value="warning">Aviso</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="todos" className="space-y-4 mt-6">
            {alertasAtivos.map(alerta => (
              <AlertaCard key={alerta.id} alerta={alerta} onResolver={resolverAlerta} />
            ))}
          </TabsContent>

          <TabsContent value="critico" className="space-y-4 mt-6">
            {alertasCriticos.map(alerta => (
              <AlertaCard key={alerta.id} alerta={alerta} onResolver={resolverAlerta} />
            ))}
          </TabsContent>

          <TabsContent value="warning" className="space-y-4 mt-6">
            {alertasWarning.map(alerta => (
              <AlertaCard key={alerta.id} alerta={alerta} onResolver={resolverAlerta} />
            ))}
          </TabsContent>

          <TabsContent value="info" className="space-y-4 mt-6">
            {alertasInfo.map(alerta => (
              <AlertaCard key={alerta.id} alerta={alerta} onResolver={resolverAlerta} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </ResourceGuard>
  );
}
