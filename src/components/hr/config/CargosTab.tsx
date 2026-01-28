import { useState, useMemo } from "react";
import { useCargosConfig, useCargoMutations, Cargo } from "@/hooks/useHRConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Search, ChevronDown, Pencil, Trash2, Users } from "lucide-react";
import CargoFormDialog from "./CargoFormDialog";
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function CargosTab() {
  const { data: cargos, isLoading } = useCargosConfig();
  const { remove } = useCargoMutations();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>({});

  // Group by area
  const groupedCargos = useMemo(() => {
    if (!cargos) return {};
    
    const filtered = cargos.filter(c => 
      c.ativo && 
      (c.nome_exibicao.toLowerCase().includes(search.toLowerCase()) ||
       c.cargo_base.toLowerCase().includes(search.toLowerCase()) ||
       c.area.toLowerCase().includes(search.toLowerCase()))
    );
    
    return filtered.reduce((acc, cargo) => {
      const area = cargo.area || 'Sem Área';
      if (!acc[area]) acc[area] = [];
      acc[area].push(cargo);
      return acc;
    }, {} as Record<string, Cargo[]>);
  }, [cargos, search]);

  const handleEdit = (cargo: Cargo) => {
    setSelectedCargo(cargo);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedCargo(null);
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      remove.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const toggleArea = (area: string) => {
    setOpenAreas(prev => ({ ...prev, [area]: !prev[area] }));
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
            placeholder="Buscar cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cargo
        </Button>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedCargos).map(([area, areaCargos]) => (
          <Collapsible
            key={area}
            open={openAreas[area] !== false}
            onOpenChange={() => toggleArea(area)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`h-4 w-4 transition-transform ${openAreas[area] !== false ? '' : '-rotate-90'}`} />
                      {area}
                      <Badge variant="secondary" className="ml-2">
                        {areaCargos.length} cargos
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Nome</th>
                          <th className="text-center px-4 py-2 font-medium">Nível</th>
                          <th className="text-right px-4 py-2 font-medium">Fixo</th>
                          <th className="text-right px-4 py-2 font-medium">Variável</th>
                          <th className="text-right px-4 py-2 font-medium">OTE</th>
                          <th className="text-center px-4 py-2 font-medium">
                            <Users className="h-4 w-4 inline" />
                          </th>
                          <th className="text-right px-4 py-2 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {areaCargos.map((cargo) => (
                          <tr key={cargo.id} className="hover:bg-muted/30">
                            <td className="px-4 py-2">
                              <span className="font-medium">{cargo.nome_exibicao}</span>
                            </td>
                            <td className="text-center px-4 py-2">
                              {cargo.nivel ? `N${cargo.nivel}` : '-'}
                            </td>
                            <td className="text-right px-4 py-2 text-muted-foreground">
                              {formatCurrency(cargo.fixo_valor)}
                            </td>
                            <td className="text-right px-4 py-2 text-muted-foreground">
                              {formatCurrency(cargo.variavel_valor)}
                            </td>
                            <td className="text-right px-4 py-2 font-medium text-primary">
                              {formatCurrency(cargo.ote_total)}
                            </td>
                            <td className="text-center px-4 py-2 text-muted-foreground">
                              {cargo.employee_count || 0}
                            </td>
                            <td className="text-right px-4 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(cargo)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteId(cargo.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}

        {Object.keys(groupedCargos).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {search ? 'Nenhum cargo encontrado' : 'Nenhum cargo cadastrado'}
          </div>
        )}
      </div>

      <CargoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cargo={selectedCargo}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cargo?</AlertDialogTitle>
            <AlertDialogDescription>
              O cargo será desativado e não aparecerá mais nas listagens.
              Esta ação pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
