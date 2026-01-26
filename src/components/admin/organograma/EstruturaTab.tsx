import { useMemo } from "react";
import { Plus, RefreshCw, Trash2, Users, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCargos, useOrganograma } from "@/hooks/useOrganograma";
import { useEmployees } from "@/hooks/useEmployees";
import { useGenerateOrganograma } from "@/hooks/useGenerateOrganograma";
import { SQUADS } from "@/types/organograma";
import { cn } from "@/lib/utils";

const SQUAD_ICONS: Record<string, string> = {
  'incorporador': '🏠',
  'consorcio': '💳',
  'credito': '💰',
  'projetos': '📊',
  'geral': '🌐',
};

export function EstruturaTab() {
  const { data: organograma, isLoading } = useOrganograma();
  const { data: cargos } = useCargos();
  const { data: employees } = useEmployees();
  const { generateFromHR, clearOrganograma } = useGenerateOrganograma();

  // Contar colaboradores por cargo_catalogo_id
  const employeeCountByCargoId = useMemo(() => {
    if (!employees) return {};
    return employees.reduce((acc, emp) => {
      if (emp.cargo_catalogo_id && emp.status === 'ativo') {
        acc[emp.cargo_catalogo_id] = (acc[emp.cargo_catalogo_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [employees]);

  // Group by squad
  const orgBySquad = useMemo(() => {
    return organograma?.reduce((acc, node) => {
      const squad = node.squad || 'geral';
      if (!acc[squad]) acc[squad] = [];
      acc[squad].push(node);
      return acc;
    }, {} as Record<string, typeof organograma>) || {};
  }, [organograma]);

  // Estatísticas
  const stats = useMemo(() => ({
    totalNodes: organograma?.length || 0,
    totalSquads: Object.keys(orgBySquad).length,
    totalEmployees: employees?.filter(e => e.status === 'ativo' && e.cargo_catalogo_id).length || 0,
  }), [organograma, orgBySquad, employees]);

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-muted-foreground">
            Visualize e gerencie a estrutura hierárquica da organização.
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="text-muted-foreground">
              {stats.totalNodes} posições • {stats.totalSquads} squads • {stats.totalEmployees} colaboradores
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => clearOrganograma.mutate()}
            disabled={clearOrganograma.isPending || stats.totalNodes === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button 
            onClick={() => generateFromHR.mutate()}
            disabled={generateFromHR.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", generateFromHR.isPending && "animate-spin")} />
            Gerar do RH
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertDescription>
          O botão "Gerar do RH" cria automaticamente o organograma baseado nos colaboradores ativos 
          que possuem cargo do catálogo vinculado. Os nodes são agrupados por squad (derivado do departamento).
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : Object.keys(orgBySquad).length > 0 ? (
        <div className="grid gap-4">
          {Object.entries(orgBySquad)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([squad, nodes]) => {
              const sortedNodes = [...nodes].sort((a, b) => 
                (a.posicao_ordem || 0) - (b.posicao_ordem || 0)
              );
              
              return (
                <Card key={squad}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className="text-xl">{SQUAD_ICONS[squad] || '📋'}</span>
                      {SQUADS.find(s => s.value === squad)?.label || squad.toUpperCase()}
                      <Badge variant="secondary" className="ml-2">
                        {nodes.length} posições
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {sortedNodes.map((node, index) => {
                        const count = node.cargo_catalogo_id 
                          ? employeeCountByCargoId[node.cargo_catalogo_id] || 0 
                          : 0;
                        
                        return (
                          <div 
                            key={node.id} 
                            className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors group"
                          >
                            {/* Indentation visual */}
                            <div className="flex items-center text-muted-foreground">
                              {index > 0 && (
                                <>
                                  <span className="w-4 border-l-2 border-muted-foreground/30 h-4 ml-2" />
                                  <ChevronRight className="h-3 w-3" />
                                </>
                              )}
                            </div>
                            
                            {/* Cargo name */}
                            <span className={cn(
                              "font-medium",
                              index === 0 && "text-primary"
                            )}>
                              {node.cargo?.nome_exibicao || 'Cargo não definido'}
                            </span>
                            
                            {/* Cargo base badge */}
                            {node.cargo?.cargo_base && (
                              <Badge variant="outline" className="text-xs">
                                {node.cargo.cargo_base}
                              </Badge>
                            )}
                            
                            {/* Employee count */}
                            {count > 0 && (
                              <Badge variant="secondary" className="ml-auto flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {count}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhuma estrutura organizacional definida.</p>
            <p className="text-sm mt-2">
              Clique em "Gerar do RH" para criar automaticamente a partir dos colaboradores cadastrados.
            </p>
            <Button 
              className="mt-4"
              onClick={() => generateFromHR.mutate()}
              disabled={generateFromHR.isPending}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", generateFromHR.isPending && "animate-spin")} />
              Gerar do RH
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cargos disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle>Cargos Disponíveis no Catálogo</CardTitle>
          <CardDescription>
            Cargos cadastrados que podem ser usados no organograma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {cargos?.map(cargo => (
              <Badge 
                key={cargo.id} 
                variant="outline" 
                className={cn(
                  "py-1.5",
                  employeeCountByCargoId[cargo.id] && "border-primary/50 bg-primary/5"
                )}
              >
                {cargo.nome_exibicao}
                <span className="text-muted-foreground ml-1">({cargo.area})</span>
                {employeeCountByCargoId[cargo.id] && (
                  <span className="ml-1 text-primary font-medium">
                    • {employeeCountByCargoId[cargo.id]}
                  </span>
                )}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
