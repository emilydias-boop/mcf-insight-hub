import { useState } from "react";
import { ResourceGuard } from "@/components/auth/ResourceGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MOCK_PROJETOS } from "@/data/mockData";
import { formatDate } from "@/lib/formatters";
import { Clock, User, Eye, TrendingUp, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const statusMap = {
  'a-fazer': { label: 'A Fazer', variant: 'secondary' as const },
  'em-andamento': { label: 'Em Andamento', variant: 'default' as const },
  'concluido': { label: 'Concluído', variant: 'outline' as const },
};

export default function Projetos() {
  const [projetos] = useState(MOCK_PROJETOS);

  const projetosAFazer = projetos.filter(p => p.status === 'a-fazer');
  const projetosEmAndamento = projetos.filter(p => p.status === 'em-andamento');
  const projetosConcluidos = projetos.filter(p => p.status === 'concluido');

  const ProjetoCard = ({ projeto }: any) => (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground">{projeto.nome}</h3>
            <Badge variant={statusMap[projeto.status as keyof typeof statusMap].variant}>
              {statusMap[projeto.status as keyof typeof statusMap].label}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="text-foreground font-medium">{projeto.progresso}%</span>
            </div>
            <Progress value={projeto.progresso} className="h-2" />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDate(projeto.prazo)}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{projeto.responsavel}</span>
          </div>

          <Button 
            size="sm" 
            variant="outline" 
            className="w-full"
            onClick={() => toast({ title: "Em breve", description: "Visualização detalhada em desenvolvimento" })}
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <ResourceGuard resource="projetos">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projetos</h1>
          <p className="text-muted-foreground mt-1">Gerenciamento de projetos de incorporação</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">A Fazer</p>
                  <p className="text-3xl font-bold text-foreground">{projetosAFazer.length}</p>
                </div>
                <Clock className="h-10 w-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Andamento</p>
                  <p className="text-3xl font-bold text-primary">{projetosEmAndamento.length}</p>
                </div>
                <TrendingUp className="h-10 w-10 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Concluídos</p>
                  <p className="text-3xl font-bold text-success">{projetosConcluidos.length}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              A Fazer
            </h2>
            <div className="space-y-4">
              {projetosAFazer.map(projeto => (
                <ProjetoCard key={projeto.id} projeto={projeto} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Em Andamento
            </h2>
            <div className="space-y-4">
              {projetosEmAndamento.map(projeto => (
                <ProjetoCard key={projeto.id} projeto={projeto} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Concluídos
            </h2>
            <div className="space-y-4">
              {projetosConcluidos.map(projeto => (
                <ProjetoCard key={projeto.id} projeto={projeto} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ResourceGuard>
  );
}
