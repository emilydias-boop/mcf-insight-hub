import { useState } from "react";
import { useSquads, useSquadMutations, useDepartamentos, Squad } from "@/hooks/useHRConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, ChevronDown, Pencil, Trash2, Users } from "lucide-react";
import SquadFormDialog from "./SquadFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SquadsTab() {
  const { data: squads, isLoading } = useSquads();
  const { data: departamentos } = useDepartamentos();
  const { remove } = useSquadMutations();
  const [search, setSearch] = useState("");
  const [filterDepartamento, setFilterDepartamento] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openDepts, setOpenDepts] = useState<Record<string, boolean>>({});

  // Filter squads
  const filtered = squads?.filter(s => 
    s.ativo &&
    s.nome.toLowerCase().includes(search.toLowerCase()) &&
    (filterDepartamento === "all" || s.departamento_id === filterDepartamento)
  ) || [];

  // Group by departamento
  const grouped = filtered.reduce((acc, squad) => {
    const deptName = squad.departamento?.nome || 'Sem Departamento';
    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(squad);
    return acc;
  }, {} as Record<string, Squad[]>);

  const handleEdit = (squad: Squad) => {
    setSelectedSquad(squad);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedSquad(null);
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      remove.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const toggleDept = (dept: string) => {
    setOpenDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar squad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterDepartamento} onValueChange={setFilterDepartamento}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos departamentos</SelectItem>
              {departamentos?.filter(d => d.ativo).map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Squad
        </Button>
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([deptName, deptSquads]) => (
          <Collapsible
            key={deptName}
            open={openDepts[deptName] !== false}
            onOpenChange={() => toggleDept(deptName)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`h-4 w-4 transition-transform ${openDepts[deptName] !== false ? '' : '-rotate-90'}`} />
                      {deptName}
                      <Badge variant="secondary" className="ml-2">
                        {deptSquads.length} squads
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-2">
                  {deptSquads.map((squad) => (
                    <div
                      key={squad.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{squad.nome}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {squad.employee_count || 0}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(squad)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(squad.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}

        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {search || filterDepartamento !== "all" ? 'Nenhuma squad encontrada' : 'Nenhuma squad cadastrada'}
          </div>
        )}
      </div>

      <SquadFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        squad={selectedSquad}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir squad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Colaboradores associados 
              a esta squad perderão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
