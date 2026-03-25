import { useState, useMemo, useEffect } from 'react';
import { Building2, Save, Loader2, CheckCircle2, Search, CheckSquare, Square, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

interface OriginItem {
  id: string;
  name: string;
  display_name: string | null;
  group_id: string | null;
}

interface GroupWithOrigins {
  id: string;
  name: string;
  display_name: string | null;
  origins: OriginItem[];
}

function useGroupsWithOrigins() {
  return useQuery({
    queryKey: ['bu-config-groups-origins'],
    queryFn: async () => {
      const [groupsRes, originsRes] = await Promise.all([
        supabase.from('crm_groups').select('id, name, display_name').order('name'),
        supabase.from('crm_origins').select('id, name, display_name, group_id').order('name'),
      ]);
      if (groupsRes.error) throw groupsRes.error;
      if (originsRes.error) throw originsRes.error;

      const originsByGroup = new Map<string, OriginItem[]>();
      const ungrouped: OriginItem[] = [];

      for (const o of originsRes.data || []) {
        if (o.group_id) {
          const list = originsByGroup.get(o.group_id) || [];
          list.push(o);
          originsByGroup.set(o.group_id, list);
        } else {
          ungrouped.push(o);
        }
      }

      const groups: GroupWithOrigins[] = (groupsRes.data || []).map(g => ({
        id: g.id,
        name: g.name,
        display_name: g.display_name,
        origins: originsByGroup.get(g.id) || [],
      }));

      return { groups, ungrouped };
    },
  });
}

export default function ConfiguracaoBU() {
  const [selectedBU, setSelectedBU] = useState<BusinessUnit>('incorporador');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedOrigins, setSelectedOrigins] = useState<Set<string>>(new Set());
  const [defaultGroup, setDefaultGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const { data: groupsData, isLoading: groupsLoading } = useGroupsWithOrigins();
  const { data: currentMapping, isLoading: mappingLoading } = useBUOriginMapping(selectedBU);
  const { data: allMappings } = useAllBUMappings();
  const saveMutation = useSaveBUOriginMapping();

  // Cross-BU map for both groups and origins
  const crossBUMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!allMappings) return map;
    for (const m of allMappings) {
      if (m.bu !== selectedBU) {
        const list = map.get(m.entity_id) || [];
        list.push(m.bu);
        map.set(m.entity_id, list);
      }
    }
    return map;
  }, [allMappings, selectedBU]);

  // Count per BU
  const buCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!allMappings) return counts;
    for (const m of allMappings) {
      counts[m.bu] = (counts[m.bu] || 0) + 1;
    }
    return counts;
  }, [allMappings]);

  // Sync from currentMapping
  useEffect(() => {
    if (currentMapping) {
      setSelectedGroups(new Set(currentMapping.filter(m => m.entity_type === 'group').map(m => m.entity_id)));
      setSelectedOrigins(new Set(currentMapping.filter(m => m.entity_type === 'origin').map(m => m.entity_id)));
      const def = currentMapping.find(m => m.is_default);
      setDefaultGroup(def?.entity_id || null);
    } else {
      setSelectedGroups(new Set());
      setSelectedOrigins(new Set());
      setDefaultGroup(null);
    }
  }, [currentMapping]);

  // Reset on BU change
  useEffect(() => {
    setSelectedGroups(new Set());
    setSelectedOrigins(new Set());
    setDefaultGroup(null);
    setExpandedGroups(new Set());
    setSearch('');
  }, [selectedBU]);

  // Filter groups/origins by search
  const filtered = useMemo(() => {
    if (!groupsData) return { groups: [], ungrouped: [] };
    const q = search.toLowerCase().trim();
    if (!q) return groupsData;

    const groups = groupsData.groups
      .map(g => {
        const groupMatch = (g.display_name || g.name).toLowerCase().includes(q);
        const matchingOrigins = g.origins.filter(o =>
          (o.display_name || o.name).toLowerCase().includes(q)
        );
        if (groupMatch) return g; // show all origins if group matches
        if (matchingOrigins.length > 0) return { ...g, origins: matchingOrigins };
        return null;
      })
      .filter(Boolean) as GroupWithOrigins[];

    const ungrouped = groupsData.ungrouped.filter(o =>
      (o.display_name || o.name).toLowerCase().includes(q)
    );

    return { groups, ungrouped };
  }, [groupsData, search]);

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

  const toggleOrigin = (originId: string) => {
    setSelectedOrigins(prev => {
      const next = new Set(prev);
      if (next.has(originId)) {
        next.delete(originId);
        if (defaultGroup === originId) setDefaultGroup(null);
      } else {
        next.add(originId);
      }
      return next;
    });
  };

  const toggleExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const totalSelected = selectedGroups.size + selectedOrigins.size;
  const totalItems = (groupsData?.groups.length || 0) + (groupsData?.ungrouped.length || 0)
    + (groupsData?.groups.reduce((acc, g) => acc + g.origins.length, 0) || 0);

  const selectAll = () => {
    const newGroups = new Set(selectedGroups);
    const newOrigins = new Set(selectedOrigins);
    filtered.groups.forEach(g => {
      newGroups.add(g.id);
      g.origins.forEach(o => newOrigins.add(o.id));
    });
    filtered.ungrouped.forEach(o => newOrigins.add(o.id));
    setSelectedGroups(newGroups);
    setSelectedOrigins(newOrigins);
  };

  const clearAll = () => {
    if (search.trim()) {
      const filteredGroupIds = new Set(filtered.groups.map(g => g.id));
      const filteredOriginIds = new Set([
        ...filtered.groups.flatMap(g => g.origins.map(o => o.id)),
        ...filtered.ungrouped.map(o => o.id),
      ]);
      setSelectedGroups(prev => {
        const next = new Set(prev);
        filteredGroupIds.forEach(id => next.delete(id));
        return next;
      });
      setSelectedOrigins(prev => {
        const next = new Set(prev);
        filteredOriginIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedGroups(new Set());
      setSelectedOrigins(new Set());
      setDefaultGroup(null);
    }
  };

  const handleSave = () => {
    const mappings = [
      ...Array.from(selectedGroups).map(id => ({
        entity_type: 'group' as const,
        entity_id: id,
        is_default: id === defaultGroup,
      })),
      ...Array.from(selectedOrigins).map(id => ({
        entity_type: 'origin' as const,
        entity_id: id,
        is_default: id === defaultGroup,
      })),
    ];
    saveMutation.mutate({ bu: selectedBU, mappings });
  };

  const isLoading = groupsLoading || mappingLoading;

  const hasChanges = useMemo(() => {
    if (!currentMapping) return totalSelected > 0;
    const curGroups = new Set(currentMapping.filter(m => m.entity_type === 'group').map(m => m.entity_id));
    const curOrigins = new Set(currentMapping.filter(m => m.entity_type === 'origin').map(m => m.entity_id));
    const curDefault = currentMapping.find(m => m.is_default)?.entity_id;
    if (selectedGroups.size !== curGroups.size || selectedOrigins.size !== curOrigins.size) return true;
    for (const id of selectedGroups) if (!curGroups.has(id)) return true;
    for (const id of selectedOrigins) if (!curOrigins.has(id)) return true;
    if (defaultGroup !== curDefault) return true;
    return false;
  }, [currentMapping, selectedGroups, selectedOrigins, defaultGroup, totalSelected]);

  const buLabel = BU_OPTIONS.find(b => b.value === selectedBU)?.short || selectedBU;

  const renderBadges = (entityId: string) => {
    const otherBUs = crossBUMap.get(entityId);
    if (!otherBUs || otherBUs.length === 0) return null;
    return (
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
    );
  };

  const renderDefaultButton = (entityId: string, isChecked: boolean) => {
    const isDefault = defaultGroup === entityId;
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground font-mono">
          {entityId.slice(0, 8)}...
        </span>
        {isChecked && !isDefault && (
          <Button variant="ghost" size="sm" onClick={() => setDefaultGroup(entityId)} className="text-xs h-7">
            Definir como padrão
          </Button>
        )}
        {isDefault && <CheckCircle2 className="h-4 w-4 text-primary" />}
      </div>
    );
  };

  // Helper to get display name for summary
  const getEntityName = (id: string): string => {
    if (!groupsData) return id.slice(0, 8);
    const group = groupsData.groups.find(g => g.id === id);
    if (group) return group.display_name || group.name;
    for (const g of groupsData.groups) {
      const origin = g.origins.find(o => o.id === id);
      if (origin) return origin.display_name || origin.name;
    }
    const ung = groupsData.ungrouped.find(o => o.id === id);
    if (ung) return ung.display_name || ung.name;
    return id.slice(0, 8);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Configuração de BU</h1>
          <p className="text-muted-foreground">
            Configure quais funis/grupos e origens pertencem a cada Business Unit
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
                <CardTitle className="text-lg">Funis e origens vinculados — {bu.short}</CardTitle>
                <CardDescription>
                  Marque grupos inteiros ou origens individuais para a {bu.label}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search + bulk actions */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar grupo ou origem..."
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
                    {totalSelected} selecionados
                  </span>
                </div>

                {/* Hierarchical list */}
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="border rounded-lg max-h-[50vh] overflow-y-auto">
                    {filtered.groups.map(group => {
                      const isGroupChecked = selectedGroups.has(group.id);
                      const isExpanded = expandedGroups.has(group.id);
                      const hasOrigins = group.origins.length > 0;

                      return (
                        <div key={group.id}>
                          {/* Group row */}
                          <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors border-b">
                            <div className="flex items-center gap-2 min-w-0">
                              {hasOrigins ? (
                                <button
                                  onClick={() => toggleExpand(group.id)}
                                  className="p-0.5 rounded hover:bg-muted"
                                >
                                  {isExpanded
                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  }
                                </button>
                              ) : (
                                <span className="w-5" />
                              )}
                              <Checkbox
                                id={`${selectedBU}-group-${group.id}`}
                                checked={isGroupChecked}
                                onCheckedChange={() => toggleGroup(group.id)}
                              />
                              <label
                                htmlFor={`${selectedBU}-group-${group.id}`}
                                className="text-sm font-medium cursor-pointer truncate"
                              >
                                {group.display_name || group.name}
                              </label>
                              {hasOrigins && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {group.origins.length} origens
                                </Badge>
                              )}
                              {defaultGroup === group.id && (
                                <Badge variant="secondary" className="text-xs shrink-0">Padrão</Badge>
                              )}
                              {renderBadges(group.id)}
                            </div>
                            {renderDefaultButton(group.id, isGroupChecked)}
                          </div>

                          {/* Child origins */}
                          {isExpanded && hasOrigins && (
                            <div className="bg-muted/20">
                              {group.origins.map(origin => {
                                const isOriginChecked = selectedOrigins.has(origin.id);
                                return (
                                  <div
                                    key={origin.id}
                                    className="flex items-center justify-between pl-10 pr-3 py-2.5 hover:bg-muted/50 transition-colors border-b"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <Checkbox
                                        id={`${selectedBU}-origin-${origin.id}`}
                                        checked={isOriginChecked}
                                        onCheckedChange={() => toggleOrigin(origin.id)}
                                      />
                                      <label
                                        htmlFor={`${selectedBU}-origin-${origin.id}`}
                                        className="text-sm cursor-pointer truncate"
                                      >
                                        {origin.display_name || origin.name}
                                      </label>
                                      {defaultGroup === origin.id && (
                                        <Badge variant="secondary" className="text-xs shrink-0">Padrão</Badge>
                                      )}
                                      {renderBadges(origin.id)}
                                    </div>
                                    {renderDefaultButton(origin.id, isOriginChecked)}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Ungrouped origins */}
                    {filtered.ungrouped.length > 0 && (
                      <>
                        <div className="px-3 py-2 bg-muted/30 border-b">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Origens sem grupo
                          </span>
                        </div>
                        {filtered.ungrouped.map(origin => {
                          const isOriginChecked = selectedOrigins.has(origin.id);
                          return (
                            <div
                              key={origin.id}
                              className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors border-b"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-5" />
                                <Checkbox
                                  id={`${selectedBU}-origin-ung-${origin.id}`}
                                  checked={isOriginChecked}
                                  onCheckedChange={() => toggleOrigin(origin.id)}
                                />
                                <label
                                  htmlFor={`${selectedBU}-origin-ung-${origin.id}`}
                                  className="text-sm cursor-pointer truncate"
                                >
                                  {origin.display_name || origin.name}
                                </label>
                                {defaultGroup === origin.id && (
                                  <Badge variant="secondary" className="text-xs shrink-0">Padrão</Badge>
                                )}
                                {renderBadges(origin.id)}
                              </div>
                              {renderDefaultButton(origin.id, isOriginChecked)}
                            </div>
                          );
                        })}
                      </>
                    )}

                    {filtered.groups.length === 0 && filtered.ungrouped.length === 0 && (
                      <p className="p-4 text-sm text-muted-foreground text-center">
                        {search ? 'Nenhum item encontrado para a busca' : 'Nenhum funil encontrado'}
                      </p>
                    )}
                  </div>
                )}

                {/* Summary */}
                {totalSelected > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">
                      {totalSelected} item(ns) vinculado(s) a {buLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[...Array.from(selectedGroups), ...Array.from(selectedOrigins)].map(id => (
                        <Badge key={id} variant={defaultGroup === id ? 'default' : 'outline'}>
                          {getEntityName(id)}
                          {defaultGroup === id && ' ★'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save */}
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
