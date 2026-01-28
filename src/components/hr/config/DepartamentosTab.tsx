import { useState } from "react";
import { useDepartamentos, useDepartamentoMutations, Departamento } from "@/hooks/useHRConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Building2, Users } from "lucide-react";
import DepartamentoFormDialog from "./DepartamentoFormDialog";
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

export default function DepartamentosTab() {
  const { data: departamentos, isLoading } = useDepartamentos();
  const { remove } = useDepartamentoMutations();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDepartamento, setSelectedDepartamento] = useState<Departamento | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = departamentos?.filter(d => 
    d.ativo &&
    (d.nome.toLowerCase().includes(search.toLowerCase()) ||
     (d.codigo?.toLowerCase().includes(search.toLowerCase())))
  ) || [];

  const handleEdit = (departamento: Departamento) => {
    setSelectedDepartamento(departamento);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedDepartamento(null);
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      remove.mutate(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar departamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Departamento
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            {filtered.map((departamento) => (
              <div
                key={departamento.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {departamento.nome}
                      {departamento.is_bu && (
                        <Badge variant="default" className="text-xs">
                          BU
                        </Badge>
                      )}
                    </div>
                    {departamento.codigo && (
                      <div className="text-sm text-muted-foreground">
                        Código: {departamento.codigo}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {departamento.employee_count || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(departamento)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(departamento.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {search ? 'Nenhum departamento encontrado' : 'Nenhum departamento cadastrado'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <DepartamentoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        departamento={selectedDepartamento}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Colaboradores associados 
              a este departamento perderão a referência.
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
