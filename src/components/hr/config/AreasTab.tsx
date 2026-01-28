import { useState } from "react";
import { useAreas, useAreaMutations, Area } from "@/hooks/useHRConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import AreaFormDialog from "./AreaFormDialog";
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

export default function AreasTab() {
  const { data: areas, isLoading } = useAreas();
  const { remove } = useAreaMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (area: Area) => {
    setEditingArea(area);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingArea(null);
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      remove.mutate(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando áreas...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Áreas
        </CardTitle>
        <Button onClick={handleNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Área
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Código</TableHead>
              <TableHead className="text-center">Ordem</TableHead>
              <TableHead className="text-center">Cargos</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areas?.map((area) => (
              <TableRow key={area.id}>
                <TableCell className="font-medium">{area.nome}</TableCell>
                <TableCell className="text-muted-foreground">{area.codigo || '-'}</TableCell>
                <TableCell className="text-center">{area.ordem}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{area.cargo_count || 0}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={area.ativo ? "default" : "outline"}>
                    {area.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(area)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setDeleteId(area.id)}
                      disabled={(area.cargo_count || 0) > 0}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!areas || areas.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma área cadastrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <AreaFormDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        area={editingArea} 
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta área? Esta ação não pode ser desfeita.
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
    </Card>
  );
}
