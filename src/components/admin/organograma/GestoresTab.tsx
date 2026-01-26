import { useState, useMemo } from "react";
import { Users, UserCheck, UserX, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployees, useEmployeeMutations } from "@/hooks/useEmployees";
import { Employee } from "@/types/hr";
import { cn } from "@/lib/utils";

// Cargos que podem ser gestores
const CARGOS_GESTORES = ['CEO', 'Diretor', 'Gerente', 'Coordenador', 'Supervisor', 'Head', 'Líder'];

export function GestoresTab() {
  const { data: employees, isLoading } = useEmployees();
  const { updateEmployee } = useEmployeeMutations();
  const [bulkGestorId, setBulkGestorId] = useState<string>("");
  const [bulkCargoFilter, setBulkCargoFilter] = useState<string>("");

  // Colaboradores ativos
  const activeEmployees = useMemo(() => 
    employees?.filter(e => e.status === 'ativo') || [], 
    [employees]
  );

  // Colaboradores sem gestor
  const semGestor = useMemo(() => 
    activeEmployees.filter(e => !e.gestor_id), 
    [activeEmployees]
  );

  // Colaboradores com gestor
  const comGestor = useMemo(() => 
    activeEmployees.filter(e => e.gestor_id), 
    [activeEmployees]
  );

  // Possíveis gestores (cargos de liderança)
  const possiveisGestores = useMemo(() => 
    activeEmployees.filter(e => 
      CARGOS_GESTORES.some(c => e.cargo?.toLowerCase().includes(c.toLowerCase()))
    ).sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || '')),
    [activeEmployees]
  );

  // Agrupar gestores por cargo para o Select
  const gestoresByCargo = useMemo(() => {
    return possiveisGestores.reduce((acc, gestor) => {
      const cargo = gestor.cargo || 'Outros';
      if (!acc[cargo]) acc[cargo] = [];
      acc[cargo].push(gestor);
      return acc;
    }, {} as Record<string, Employee[]>);
  }, [possiveisGestores]);

  // Cargos únicos dos colaboradores sem gestor (para ação em lote)
  const cargosUnicos = useMemo(() => 
    [...new Set(semGestor.map(e => e.cargo).filter(Boolean))].sort(),
    [semGestor]
  );

  // Filtrar por cargo para ação em lote
  const filteredForBulk = useMemo(() => 
    bulkCargoFilter 
      ? semGestor.filter(e => e.cargo === bulkCargoFilter)
      : [],
    [semGestor, bulkCargoFilter]
  );

  const handleAssignGestor = (employeeId: string, gestorId: string | null) => {
    updateEmployee.mutate({
      id: employeeId,
      data: { gestor_id: gestorId }
    });
  };

  const handleBulkAssign = () => {
    if (!bulkGestorId || filteredForBulk.length === 0) return;
    
    filteredForBulk.forEach(emp => {
      updateEmployee.mutate({
        id: emp.id,
        data: { gestor_id: bulkGestorId }
      });
    });

    setBulkCargoFilter("");
    setBulkGestorId("");
  };

  const getGestorName = (gestorId: string) => {
    const gestor = employees?.find(e => e.id === gestorId);
    return gestor?.nome_completo || 'Desconhecido';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <UserX className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{semGestor.length}</p>
                <p className="text-sm text-muted-foreground">Sem Gestor</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{comGestor.length}</p>
                <p className="text-sm text-muted-foreground">Com Gestor</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{possiveisGestores.length}</p>
                <p className="text-sm text-muted-foreground">Gestores Disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Action */}
      {semGestor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Ação em Lote
            </CardTitle>
            <CardDescription>
              Defina o gestor para múltiplos colaboradores de uma vez
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Filtrar por Cargo</label>
                <Select value={bulkCargoFilter} onValueChange={setBulkCargoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargosUnicos.map(cargo => (
                      <SelectItem key={cargo} value={cargo!}>
                        {cargo} ({semGestor.filter(e => e.cargo === cargo).length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Atribuir a</label>
                <Select value={bulkGestorId} onValueChange={setBulkGestorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(gestoresByCargo).map(([cargo, gestores]) => (
                      <SelectGroup key={cargo}>
                        <SelectLabel>{cargo}</SelectLabel>
                        {gestores.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.nome_completo}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleBulkAssign}
                disabled={!bulkGestorId || filteredForBulk.length === 0 || updateEmployee.isPending}
              >
                Aplicar a {filteredForBulk.length} colaborador(es)
              </Button>
            </div>

            {bulkCargoFilter && filteredForBulk.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Colaboradores selecionados:</p>
                <div className="flex flex-wrap gap-2">
                  {filteredForBulk.map(emp => (
                    <Badge key={emp.id} variant="secondary">
                      {emp.nome_completo}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* List of employees without manager */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Colaboradores sem Gestor ({semGestor.length})
          </CardTitle>
          <CardDescription>
            Defina o gestor de cada colaborador diretamente na lista
          </CardDescription>
        </CardHeader>
        <CardContent>
          {semGestor.length === 0 ? (
            <Alert className="border-emerald-500/50 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                Todos os colaboradores ativos possuem um gestor definido!
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {semGestor.map(emp => (
                  <div 
                    key={emp.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {emp.nome_completo?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium">{emp.nome_completo}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {emp.cargo || 'Sem cargo'}
                          </Badge>
                          {emp.departamento && (
                            <span className="text-xs text-muted-foreground">
                              {emp.departamento}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Select 
                      value={emp.gestor_id || ""} 
                      onValueChange={(v) => handleAssignGestor(emp.id, v || null)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Selecionar gestor" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(gestoresByCargo).map(([cargo, gestores]) => (
                          <SelectGroup key={cargo}>
                            <SelectLabel>{cargo}</SelectLabel>
                            {gestores.map(g => (
                              <SelectItem 
                                key={g.id} 
                                value={g.id}
                                disabled={g.id === emp.id}
                              >
                                {g.nome_completo}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* List of employees with manager (reference) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Colaboradores com Gestor ({comGestor.length})
          </CardTitle>
          <CardDescription>
            Visualize ou altere o gestor atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {comGestor.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum colaborador com gestor definido ainda.
            </p>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {comGestor.map(emp => (
                  <div 
                    key={emp.id} 
                    className="flex items-center justify-between p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-sm font-medium text-emerald-600">
                        {emp.nome_completo?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium">{emp.nome_completo}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {emp.cargo || 'Sem cargo'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            → {getGestorName(emp.gestor_id!)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <Select 
                      value={emp.gestor_id || ""} 
                      onValueChange={(v) => handleAssignGestor(emp.id, v || null)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder={getGestorName(emp.gestor_id!)} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">
                          <span className="text-destructive">Remover gestor</span>
                        </SelectItem>
                        {Object.entries(gestoresByCargo).map(([cargo, gestores]) => (
                          <SelectGroup key={cargo}>
                            <SelectLabel>{cargo}</SelectLabel>
                            {gestores.map(g => (
                              <SelectItem 
                                key={g.id} 
                                value={g.id}
                                disabled={g.id === emp.id}
                              >
                                {g.nome_completo}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
