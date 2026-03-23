import { useState, useMemo, useEffect } from 'react';
import { Building2, Save, Loader2, CheckCircle2, Search, CheckSquare, Square } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useCRMPipelines } from '@/components/crm/PipelineSelector';
import { useBUOriginMapping, useSaveBUOriginMapping, useAllBUMappings } from '@/hooks/useBUOriginMapping';
import { BusinessUnit } from '@/hooks/useMyBU';

const BU_OPTIONS: { value: BusinessUnit; label: string; short: string }[] = [
  { value: 'incorporador', label: 'BU - Incorporador MCF', short: 'Incorporador' },
  { value: 'consorcio', label: 'BU - Consórcio', short: 'Consórcio' },
  { value: 'credito', label: 'BU - Crédito', short: 'Crédito' },
  { value: 'projetos', label: 'BU - Projetos', short: 'Projetos' },
  { value: 'leilao', label: 'BU - Leilão', short: 'Leilão' },
  { value: 'marketing', label: 'BU - Marketing', short: 'Marketing' },
];

export default function ConfiguracaoBU() {
  const [selectedBU, setSelectedBU] = useState<BusinessUnit>('incorporador');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [defaultGroup, setDefaultGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: pipelines, isLoading: pipelinesLoading } = useCRMPipelines();
  const { data: currentMapping, isLoading: mappingLoading } = useBUOriginMapping(selectedBU);
  const { data: allMappings } = useAllBUMappings();
  const saveMutation = useSaveBUOriginMapping();

  // Mapeamento cross-BU: pipeline_id -> lista de BUs que a usam
  const crossBUMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!allMappings) return map;
    for (const m of allMappings) {
      if (m.entity_type === 'group' && m.bu !== selectedBU) {
        const list = map.get(m.entity_id) || [];
        list.push(m.bu);
        map.set(m.entity_id, list);
      }
    }
    return map;
  }, [allMappings, selectedBU]);

  // Contagem de pipelines por BU
  const buCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!allMappings) return counts;
    for (const m of allMappings) {
      if (m.entity_type === 'group') {
        counts[m.bu] = (counts[m.bu] || 0) + 1;
      }
    }
    return counts;
  }, [allMappings]);

  useEffect(() => {
    if (currentMapping) {
      const groupIds = currentMapping.filter(m => m.entity_type === 'group').map(m => m.entity_id);
      setSelectedGroups(new Set(groupIds));
      const def = currentMapping.find(m => m.entity_type === 'group' && m.is_default);
      setDefaultGroup(def?.entity_id || null);
    } else {
      setSelectedGroups(new Set());
      setDefaultGroup(null);
    }
  }, [currentMapping]);

  useEffect(() => {
    setSelectedGroups(new Set());
    setDefaultGroup(null);
    setSearch('');
  }, [selectedBU]);

  const filteredPipelines = useMemo(() => {
    if (!pipelines) return [];
    if (!search.trim()) return pipelines;
    const q = search.toLowerCase();
    return pipelines.filter(p =>
      (p.display_name || p.name || '').toLowerCase().includes(q)
    );
  }, [pipelines, search]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
        if (defaultGroup === groupId) setDefaultGroup(null);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = new Set(selectedGroups);
    filteredPipelines.forEach(p => allIds.add(p.id));
    setSelectedGroups(allIds);
  };

  const clearAll = () => {
    if (search.trim()) {
      const filtered = new Set(filteredPipelines.map(p => p.id));
      setSelectedGroups(prev => {
        const next = new Set(prev);
        filtered.forEach(id => {
          next.delete(id);
          if (defaultGroup === id) setDefaultGroup(null);
        });
        return next;
      });
    } else {
      setSelectedGroups(new Set());
      setDefaultGroup(null);
    }
  };

  const handleSave = () => {
    const mappings = Array.from(selectedGroups).map(groupId => ({
      entity_type: 'group' as const,
      entity_id: groupId,
      is_default: groupId === defaultGroup,
    }));
    saveMutation.mutate({ bu: selectedBU, mappings });
  };

  const isLoading = pipelinesLoading || mappingLoading;
  const hasChanges = useMemo(() => {
    if (!currentMapping) return selectedGroups.size > 0;
    const currentGroupIds = new Set(currentMapping.filter(m => m.entity_type === 'group').map(m => m.entity_id));
    const currentDefault = currentMapping.find(m => m.entity_type === 'group' && m.is_default)?.entity_id;
    if (selectedGroups.size !== currentGroupIds.size) return true;
    for (const id of selectedGroups) if (!currentGroupIds.has(id)) return true;
    if (defaultGroup !== currentDefault) return true;
    return false;
  }, [currentMapping, selectedGroups, defaultGroup]);

  const buLabel = BU_OPTIONS.find(b => b.value === selectedBU)?.short || selectedBU;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Configuração de BU</h1>
          <p className="text-muted-foreground">
            Configure quais funis/grupos pertencem a cada Business Unit
          </p>
        </div>
      </div>

      <Tabs value={selectedBU} onValueChange={(v) => setSelectedBU(v as BusinessUnit)}>
        <TabsList className="w-full justify-start">
          {BU_OPTIONS.map(bu => (
            <TabsTrigger key={bu.value} value={bu.value} className="gap-1.5">
              {bu.short}
              {(buCounts[bu.value] ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                  {buCounts[bu.value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {BU_OPTIONS.map(bu => (
          <TabsContent key={bu.value} value={bu.value}>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Funis vinculados — {bu.short}</CardTitle>
                <CardDescription>
                  Marque os funis que devem aparecer para usuários da {bu.label}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Busca + ações em massa */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar funil..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAll} className="gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5" />
                    Selecionar todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5">
                    <Square className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {selectedGroups.size} de {pipelines?.length || 0} selecionados
                  </span>
                </div>

                {/* Lista de pipelines */}
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y max-h-[50vh] overflow-y-auto">
                    {filteredPipelines.map(pipeline => {
                      const isChecked = selectedGroups.has(pipeline.id);
                      const isDefault = defaultGroup === pipeline.id;
                      const otherBUs = crossBUMap.get(pipeline.id);

                      return (
                        <div
                          key={pipeline.id}
                          className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox
                              id={`${selectedBU}-${pipeline.id}`}
                              checked={isChecked}
                              onCheckedChange={() => toggleGroup(pipeline.id)}
                            />
                            <label
                              htmlFor={`${selectedBU}-${pipeline.id}`}
                              className="text-sm font-medium cursor-pointer truncate"
                            >
                              {pipeline.display_name || pipeline.name}
                            </label>
                            {isDefault && (
                              <Badge variant="secondary" className="text-xs shrink-0">Padrão</Badge>
                            )}
                            {otherBUs && otherBUs.length > 0 && (
                              <div className="flex gap-1 shrink-0">
                                {otherBUs.map(b => {
                                  const buInfo = BU_OPTIONS.find(o => o.value === b);
                                  return (
                                    <Badge key={b} variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                      {buInfo?.short || b}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground font-mono">
                              {pipeline.id.slice(0, 8)}...
                            </span>
                            {isChecked && !isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDefaultGroup(pipeline.id)}
                                className="text-xs h-7"
                              >
                                Definir como padrão
                              </Button>
                            )}
                            {isDefault && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                        </div>
                      );
                    })}

                    {filteredPipelines.length === 0 && (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        {search ? 'Nenhum funil encontrado para a busca' : 'Nenhum funil encontrado'}
                      </p>
                    )}
                  </div>
                )}

                {/* Resumo */}
                {selectedGroups.size > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">
                      {selectedGroups.size} funil(is) vinculado(s) a {buLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedGroups).map(id => {
                        const p = pipelines?.find(x => x.id === id);
                        return (
                          <Badge key={id} variant={defaultGroup === id ? 'default' : 'outline'}>
                            {p?.display_name || p?.name || id.slice(0, 8)}
                            {defaultGroup === id && ' ★'}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Salvar */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending || !hasChanges}
                    className="gap-2"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar Configuração
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
