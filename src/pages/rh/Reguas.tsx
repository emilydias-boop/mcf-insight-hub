import { useState, useMemo } from "react";
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useReguas, useReguaFaixas, useReguaMutations } from "@/hooks/useFechamentoGenerico";
import { ReguaFormDialog } from "@/components/fechamento-generico/ReguaFormDialog";
import { ReguaMultiplicador } from "@/types/fechamento-generico";

function ReguaCard({ 
  regua, 
  onEdit, 
  onDelete 
}: { 
  regua: ReguaMultiplicador; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: faixas = [], isLoading } = useReguaFaixas(isOpen ? regua.id : null);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent">
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-lg">{regua.nome_regua}</CardTitle>
                </div>
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Badge variant={regua.ativo ? "default" : "outline"}>
                {regua.ativo ? "Ativa" : "Inativa"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : faixas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma faixa configurada. Edite a régua para adicionar faixas.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Faixa De</TableHead>
                    <TableHead>Faixa Até</TableHead>
                    <TableHead className="text-right">Multiplicador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faixas
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((faixa) => (
                      <TableRow key={faixa.id}>
                        <TableCell>{faixa.faixa_de}%</TableCell>
                        <TableCell>
                          {faixa.faixa_ate === 999 ? "∞" : `${faixa.faixa_ate}%`}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {faixa.multiplicador.toFixed(2)}x
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function RHReguas() {
  const { data: reguas = [], isLoading } = useReguas();
  const { deleteRegua } = useReguaMutations();
  
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegua, setEditingRegua] = useState<ReguaMultiplicador | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reguaToDelete, setReguaToDelete] = useState<ReguaMultiplicador | null>(null);

  const filteredReguas = useMemo(() => {
    return reguas.filter((regua) =>
      regua.nome_regua.toLowerCase().includes(search.toLowerCase())
    );
  }, [reguas, search]);

  const stats = useMemo(() => ({
    total: reguas.length,
    ativas: reguas.filter(r => r.ativo).length,
  }), [reguas]);

  const handleEdit = (regua: ReguaMultiplicador) => {
    setEditingRegua(regua);
    setDialogOpen(true);
  };

  const handleDelete = (regua: ReguaMultiplicador) => {
    setReguaToDelete(regua);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (reguaToDelete) {
      deleteRegua.mutate(reguaToDelete.id);
      setDeleteDialogOpen(false);
      setReguaToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingRegua(null);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Réguas de Multiplicador</h1>
          <p className="text-muted-foreground">
            Configure as faixas de percentual e seus multiplicadores
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Régua
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Réguas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Réguas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.ativas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar régua..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Réguas List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
            </Card>
          ))
        ) : filteredReguas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma régua encontrada
            </CardContent>
          </Card>
        ) : (
          filteredReguas.map((regua) => (
            <ReguaCard
              key={regua.id}
              regua={regua}
              onEdit={() => handleEdit(regua)}
              onDelete={() => handleDelete(regua)}
            />
          ))
        )}
      </div>

      {/* Form Dialog */}
      <ReguaFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        regua={editingRegua}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir régua?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a régua "{reguaToDelete?.nome_regua}"? 
              Todas as faixas associadas também serão excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
