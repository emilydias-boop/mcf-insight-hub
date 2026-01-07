import { useState, useMemo } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useCargos, useCargoMutations } from "@/hooks/useFechamentoGenerico";
import { CargoFormDialog } from "@/components/fechamento-generico/CargoFormDialog";
import { CargoCatalogo, AREA_OPTIONS, MODELO_VARIAVEL_OPTIONS } from "@/types/fechamento-generico";

export default function RHCargos() {
  const { data: cargos = [], isLoading } = useCargos();
  const { deleteCargo } = useCargoMutations();
  
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<CargoCatalogo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cargoToDelete, setCargoToDelete] = useState<CargoCatalogo | null>(null);

  const filteredCargos = useMemo(() => {
    return cargos.filter((cargo) => {
      const matchesSearch = 
        cargo.nome_exibicao.toLowerCase().includes(search.toLowerCase()) ||
        cargo.cargo_base.toLowerCase().includes(search.toLowerCase());
      const matchesArea = areaFilter === "all" || cargo.area === areaFilter;
      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "ativo" && cargo.ativo) ||
        (statusFilter === "inativo" && !cargo.ativo);
      return matchesSearch && matchesArea && matchesStatus;
    });
  }, [cargos, search, areaFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: cargos.length,
    ativos: cargos.filter(c => c.ativo).length,
    areas: new Set(cargos.map(c => c.area)).size,
  }), [cargos]);

  const handleEdit = (cargo: CargoCatalogo) => {
    setEditingCargo(cargo);
    setDialogOpen(true);
  };

  const handleDelete = (cargo: CargoCatalogo) => {
    setCargoToDelete(cargo);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (cargoToDelete) {
      deleteCargo.mutate(cargoToDelete.id);
      setDeleteDialogOpen(false);
      setCargoToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCargo(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getModeloLabel = (modelo: string) => {
    return MODELO_VARIAVEL_OPTIONS.find(m => m.value === modelo)?.label || modelo;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de Cargos</h1>
          <p className="text-muted-foreground">
            Gerencie os cargos e suas estruturas de remuneração
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cargo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Cargos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cargos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.ativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Áreas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.areas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou cargo base..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Áreas</SelectItem>
            {AREA_OPTIONS.map((area) => (
              <SelectItem key={area} value={area}>
                {area}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Exibição</TableHead>
                <TableHead>Cargo Base</TableHead>
                <TableHead>Área</TableHead>
                <TableHead className="text-center">Nível</TableHead>
                <TableHead className="text-right">Fixo</TableHead>
                <TableHead className="text-right">Variável</TableHead>
                <TableHead className="text-right">OTE</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredCargos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhum cargo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredCargos.map((cargo) => (
                  <TableRow 
                    key={cargo.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEdit(cargo)}
                  >
                    <TableCell className="font-medium">{cargo.nome_exibicao}</TableCell>
                    <TableCell>{cargo.cargo_base}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{cargo.area}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {cargo.nivel ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(cargo.fixo_valor)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(cargo.variavel_valor)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(cargo.ote_total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getModeloLabel(cargo.modelo_variavel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={cargo.ativo ? "default" : "outline"}>
                        {cargo.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(cargo);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cargo);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <CargoFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        cargo={editingCargo}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cargo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cargo "{cargoToDelete?.nome_exibicao}"? 
              Esta ação não pode ser desfeita.
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
