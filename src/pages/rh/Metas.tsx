import { useState, useMemo } from "react";
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { format, subMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  useMetasMes, 
  useMetaComponentes, 
  useMetaMutations,
  useReguas 
} from "@/hooks/useFechamentoGenerico";
import { MetaFormDialog } from "@/components/fechamento-generico/MetaFormDialog";
import { CompetenciaSelector } from "@/components/fechamento-generico/CompetenciaSelector";
import { MetaMes, AREA_OPTIONS } from "@/types/fechamento-generico";

function MetaCard({ 
  meta,
  reguasMap,
  onEdit, 
  onDelete 
}: { 
  meta: MetaMes;
  reguasMap: Map<string, string>;
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: componentes = [], isLoading } = useMetaComponentes(isOpen ? meta.id : null);

  const reguaNome = meta.regua_id ? reguasMap.get(meta.regua_id) || "—" : "—";

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
                  <div className="text-left">
                    <CardTitle className="text-lg">
                      {meta.cargo_base} {meta.nivel ? `Nível ${meta.nivel}` : ""}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {meta.area} • Régua: {reguaNome}
                    </p>
                  </div>
                </div>
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Badge variant={meta.ativo ? "default" : "outline"}>
                {meta.ativo ? "Ativa" : "Inativa"}
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
            {meta.observacao && (
              <p className="text-sm text-muted-foreground mb-4 italic">
                {meta.observacao}
              </p>
            )}
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : componentes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum componente configurado. Edite a meta para adicionar componentes.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Componente</TableHead>
                    <TableHead className="text-right">Valor Base</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {componentes
                    .filter(c => c.ativo)
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell className="font-mono text-muted-foreground">
                          {comp.ordem}
                        </TableCell>
                        <TableCell className="font-medium">{comp.nome_componente}</TableCell>
                        <TableCell className="text-right font-mono">
                          {comp.valor_base}
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

export default function RHMetas() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [competencia, setCompetencia] = useState(currentMonth);
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  
  const { data: metas = [], isLoading } = useMetasMes(competencia);
  const { data: reguas = [] } = useReguas();
  const { deleteMeta } = useMetaMutations();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<MetaMes | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [metaToDelete, setMetaToDelete] = useState<MetaMes | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);

  const reguasMap = useMemo(() => {
    return new Map(reguas.map(r => [r.id, r.nome_regua]));
  }, [reguas]);

  const filteredMetas = useMemo(() => {
    return metas.filter((meta) => {
      const matchesSearch = 
        meta.cargo_base.toLowerCase().includes(search.toLowerCase());
      const matchesArea = areaFilter === "all" || meta.area === areaFilter;
      return matchesSearch && matchesArea;
    });
  }, [metas, search, areaFilter]);

  // Group by area
  const metasByArea = useMemo(() => {
    const grouped = new Map<string, MetaMes[]>();
    filteredMetas.forEach((meta) => {
      const existing = grouped.get(meta.area) || [];
      grouped.set(meta.area, [...existing, meta]);
    });
    return grouped;
  }, [filteredMetas]);

  const stats = useMemo(() => ({
    total: metas.length,
    ativas: metas.filter(m => m.ativo).length,
    areas: new Set(metas.map(m => m.area)).size,
  }), [metas]);

  const competenciaLabel = useMemo(() => {
    const date = parse(competencia, "yyyy-MM", new Date());
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  }, [competencia]);

  const previousMonth = useMemo(() => {
    const date = parse(competencia, "yyyy-MM", new Date());
    return format(subMonths(date, 1), "yyyy-MM");
  }, [competencia]);

  const handleEdit = (meta: MetaMes) => {
    setEditingMeta(meta);
    setDialogOpen(true);
  };

  const handleDelete = (meta: MetaMes) => {
    setMetaToDelete(meta);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (metaToDelete) {
      deleteMeta.mutate(metaToDelete.id);
      setDeleteDialogOpen(false);
      setMetaToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingMeta(null);
  };

  const handleCopyFromPrevious = async () => {
    // TODO: Implement copy metas from previous month
    // For now, just close the dialog
    setCopyDialogOpen(false);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Metas do Mês</h1>
          <p className="text-muted-foreground">
            Configure as metas por competência, área e cargo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setCopyDialogOpen(true)}
            disabled={metas.length > 0}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copiar do Mês Anterior
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Meta
          </Button>
        </div>
      </div>

      {/* Competência Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <CompetenciaSelector
          value={competencia}
          onChange={setCompetencia}
        />
        <p className="text-lg font-medium capitalize">{competenciaLabel}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Metas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Metas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.ativas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Áreas Configuradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.areas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cargo..."
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
      </div>

      {/* Metas List by Area */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredMetas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma meta encontrada para {competenciaLabel}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(metasByArea.entries()).map(([area, areaMetas]) => (
            <div key={area} className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Badge variant="outline">{area}</Badge>
                <span className="text-muted-foreground text-sm font-normal">
                  ({areaMetas.length} {areaMetas.length === 1 ? "meta" : "metas"})
                </span>
              </h2>
              <div className="space-y-3 pl-2">
                {areaMetas.map((meta) => (
                  <MetaCard
                    key={meta.id}
                    meta={meta}
                    reguasMap={reguasMap}
                    onEdit={() => handleEdit(meta)}
                    onDelete={() => handleDelete(meta)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <MetaFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        meta={editingMeta}
        defaultCompetencia={competencia}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a meta de "{metaToDelete?.cargo_base}"? 
              Todos os componentes associados também serão excluídos. Esta ação não pode ser desfeita.
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

      {/* Copy Confirmation */}
      <AlertDialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar metas do mês anterior?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso copiará todas as metas e componentes de {format(parse(previousMonth, "yyyy-MM", new Date()), "MMMM/yyyy", { locale: ptBR })} para {competenciaLabel}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCopyFromPrevious}>
              Copiar Metas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
