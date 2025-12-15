import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOriginManagement, OriginUpdate, ManagedOrigin } from '@/hooks/useOriginManagement';
import { Search, Save, MapPin, GitBranch, LayoutGrid, Undo2 } from 'lucide-react';

const Origens = () => {
  const { origins, isLoading, updateOrigins, isUpdating } = useOriginManagement();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pipelines' | 'sub-origins'>('all');
  
  // Track local edits
  const [edits, setEdits] = useState<Map<string, Partial<ManagedOrigin>>>(new Map());

  const filteredOrigins = useMemo(() => {
    let filtered = origins;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(o =>
        o.name.toLowerCase().includes(term) ||
        o.display_name?.toLowerCase().includes(term) ||
        o.group_name?.toLowerCase().includes(term)
      );
    }

    // Apply type filter
    if (filterType === 'pipelines') {
      filtered = filtered.filter(o => o.pipeline_type === 'pipeline');
    } else if (filterType === 'sub-origins') {
      filtered = filtered.filter(o => o.pipeline_type !== 'pipeline');
    }

    return filtered;
  }, [origins, searchTerm, filterType]);

  const hasChanges = edits.size > 0;

  // Effective pipelines list that considers local edits
  const effectivePipelines = useMemo(() => {
    return origins.filter(origin => {
      const edit = edits.get(origin.id);
      // If there's a local edit for pipeline_type, use that
      if (edit && 'pipeline_type' in edit) {
        return edit.pipeline_type === 'pipeline';
      }
      // Otherwise use the saved value
      return origin.pipeline_type === 'pipeline';
    });
  }, [origins, edits]);

  const getEditedValue = <K extends keyof ManagedOrigin>(
    origin: ManagedOrigin,
    field: K
  ): ManagedOrigin[K] => {
    const edit = edits.get(origin.id);
    if (edit && field in edit) {
      return edit[field] as ManagedOrigin[K];
    }
    return origin[field];
  };

  const updateEdit = (originId: string, field: keyof ManagedOrigin, value: any) => {
    setEdits(prev => {
      const newEdits = new Map(prev);
      const current = newEdits.get(originId) || {};
      newEdits.set(originId, { ...current, [field]: value });
      return newEdits;
    });
  };

  const handleSave = () => {
    const updates: OriginUpdate[] = Array.from(edits.entries()).map(([id, changes]) => ({
      id,
      ...(changes.display_name !== undefined && { display_name: changes.display_name }),
      ...(changes.parent_id !== undefined && { parent_id: changes.parent_id }),
      ...(changes.pipeline_type !== undefined && { pipeline_type: changes.pipeline_type }),
    }));

    if (updates.length > 0) {
      updateOrigins(updates, {
        onSuccess: () => {
          setEdits(new Map());
        },
      });
    }
  };

  const handleReset = () => {
    setEdits(new Map());
  };

  const stats = useMemo(() => {
    const total = origins.length;
    const pipelinesCount = origins.filter(o => o.pipeline_type === 'pipeline').length;
    const withParent = origins.filter(o => o.parent_id).length;
    const totalDeals = origins.reduce((sum, o) => sum + (o.deal_count || 0), 0);
    return { total, pipelinesCount, withParent, totalDeals };
  }, [origins]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gerenciar Origens e Hierarquia</h2>
          <p className="text-muted-foreground">Configure nomes amigáveis, pipelines principais e hierarquia pai-filho</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset} disabled={isUpdating}>
              <Undo2 className="h-4 w-4 mr-2" />
              Descartar
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || isUpdating}>
            <Save className="h-4 w-4 mr-2" />
            {isUpdating ? 'Salvando...' : `Salvar ${edits.size} alteração(ões)`}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Origens</CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipelines Principais</CardTitle>
            <LayoutGrid className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold text-foreground">{stats.pipelinesCount}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com Hierarquia</CardTitle>
            <GitBranch className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold text-foreground">{stats.withParent}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Negócios</CardTitle>
            <MapPin className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold text-foreground">{stats.totalDeals.toLocaleString('pt-BR')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou grupo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card border-border text-foreground"
          />
        </div>
        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
          <SelectTrigger className="w-[200px] bg-card border-border">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pipelines">Apenas Pipelines</SelectItem>
            <SelectItem value="sub-origins">Apenas Sub-origens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Editable Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="w-[250px]">Nome Original</TableHead>
                    <TableHead className="w-[200px]">Nome Amigável</TableHead>
                    <TableHead className="w-[120px] text-center">Pipeline?</TableHead>
                    <TableHead className="w-[200px]">Pipeline Pai</TableHead>
                    <TableHead className="w-[150px]">Grupo</TableHead>
                    <TableHead className="w-[100px] text-right">Negócios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrigins.map((origin) => {
                    const isPipeline = getEditedValue(origin, 'pipeline_type') === 'pipeline';
                    const parentId = getEditedValue(origin, 'parent_id');
                    const displayName = getEditedValue(origin, 'display_name') || '';
                    const hasEdits = edits.has(origin.id);

                    return (
                      <TableRow
                        key={origin.id}
                        className={`border-border hover:bg-muted/50 ${hasEdits ? 'bg-warning/10' : ''}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-foreground truncate max-w-[230px]" title={origin.name}>
                              {origin.name}
                            </span>
                            <span className="text-xs text-muted-foreground truncate max-w-[230px]">
                              {origin.clint_id.slice(0, 8)}...
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={displayName}
                            onChange={(e) => updateEdit(origin.id, 'display_name', e.target.value || null)}
                            placeholder="Nome amigável..."
                            className="h-8 bg-background border-border text-foreground"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={isPipeline}
                            onCheckedChange={(checked) =>
                              updateEdit(origin.id, 'pipeline_type', checked ? 'pipeline' : 'outros')
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={parentId || 'none'}
                            onValueChange={(v) => updateEdit(origin.id, 'parent_id', v === 'none' ? null : v)}
                            disabled={isPipeline}
                          >
                            <SelectTrigger className="h-8 bg-background border-border" disabled={isPipeline}>
                              <SelectValue placeholder="Sem pai" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem pai</SelectItem>
                              {effectivePipelines
                                .filter(p => p.id !== origin.id)
                                .map((pipeline) => (
                                  <SelectItem key={pipeline.id} value={pipeline.id}>
                                    {pipeline.display_name || pipeline.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {origin.group_name ? (
                            <Badge variant="secondary" className="truncate max-w-[140px]">
                              {origin.group_name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-foreground font-medium">
                            {(origin.deal_count || 0).toLocaleString('pt-BR')}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && filteredOrigins.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhuma origem encontrada
            </h3>
            <p className="text-muted-foreground">
              Tente ajustar os filtros de busca
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Origens;
