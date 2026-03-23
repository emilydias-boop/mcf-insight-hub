import { useState, useMemo } from 'react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useRolesConfig } from '@/hooks/useRolesConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Save, Shield, Search, Copy, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionLevel, AppRole, ResourceType, RESOURCE_LABELS } from '@/types/user-management';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const GLOBAL_RESOURCES: ResourceType[] = [
  'dashboard', 'receita', 'custos', 'relatorios', 'alertas', 'usuarios',
  'financeiro', 'configuracoes', 'patrimonio', 'tv_sdr', 'agenda_r2',
];

const BU_RESOURCE_MAP: Record<string, ResourceType[]> = {
  incorporador: ['crm', 'fechamento_sdr', 'efeito_alavanca'],
  consorcio: ['crm', 'fechamento_sdr', 'efeito_alavanca'],
  credito: ['crm', 'fechamento_sdr', 'efeito_alavanca', 'credito'],
  projetos: ['crm', 'fechamento_sdr', 'efeito_alavanca', 'projetos'],
  leilao: ['crm', 'fechamento_sdr', 'efeito_alavanca', 'leilao'],
  marketing: ['marketing_dashboard_ads', 'marketing_campanhas', 'marketing_aquisicao_a010', 'marketing_config_links', 'marketing_documentos'],
};

const BU_TABS = [
  { value: '__global__', label: 'Global' },
  { value: 'incorporador', label: 'Incorporador' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'credito', label: 'Crédito' },
  { value: 'projetos', label: 'Projetos' },
  { value: 'leilao', label: 'Leilão' },
  { value: 'marketing', label: 'Marketing' },
];

const PERMISSION_LEVELS: PermissionLevel[] = ['none', 'view', 'edit', 'full'];

const PERMISSION_COLORS: Record<PermissionLevel, string> = {
  none: 'bg-destructive/20 text-destructive border-destructive/30',
  view: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  edit: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
  full: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
};

const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  none: 'Nenhum',
  view: 'Visualizar',
  edit: 'Editar',
  full: 'Total',
};

export default function AdminPermissoes() {
  const [activeTab, setActiveTab] = useState('__global__');
  const buFilter = activeTab === '__global__' ? null : activeTab;

  const { permissionsMap, isLoading, updatePermissions, resourceHasOverride } = useRolePermissions(buFilter);
  const { roles: rolesConfigList, roleLabels, isLoading: rolesLoading } = useRolesConfig(true);
  const ALL_ROLES = rolesConfigList.map(r => r.role_key as AppRole);
  const ROLE_LABELS_MAP = roleLabels as Record<AppRole, string>;

  const [localChanges, setLocalChanges] = useState<Record<string, Record<string, PermissionLevel>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [showAdmin, setShowAdmin] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySource, setCopySource] = useState('');
  const [copyTarget, setCopyTarget] = useState('');

  const resources = activeTab === '__global__' ? GLOBAL_RESOURCES : (BU_RESOURCE_MAP[activeTab] || []);

  // Filter roles to display
  const visibleRoles = useMemo(() => {
    let roles = ALL_ROLES.filter(r => showAdmin || r !== 'admin');
    if (selectedRoles.size > 0) {
      roles = roles.filter(r => selectedRoles.has(r));
    }
    return roles;
  }, [ALL_ROLES, showAdmin, selectedRoles]);

  // Filter resources by search
  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) return resources;
    const q = searchQuery.toLowerCase();
    return resources.filter(r => {
      const label = RESOURCE_LABELS[r] || r;
      return label.toLowerCase().includes(q) || r.toLowerCase().includes(q);
    });
  }, [resources, searchQuery]);

  const getCurrentValue = (role: AppRole, resource: ResourceType): PermissionLevel => {
    if (localChanges[role]?.[resource]) return localChanges[role][resource];
    return permissionsMap[role]?.[resource] || 'none';
  };

  const handleChange = (role: AppRole, resource: ResourceType, value: PermissionLevel) => {
    setLocalChanges(prev => ({
      ...prev,
      [role]: { ...(prev[role] || {}), [resource]: value },
    }));
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: { role: string; resource: string; permissionLevel: PermissionLevel; bu: string | null }[] = [];
      Object.entries(localChanges).forEach(([role, res]) => {
        Object.entries(res).forEach(([resource, level]) => {
          updates.push({ role, resource, permissionLevel: level, bu: buFilter });
        });
      });
      await updatePermissions.mutateAsync(updates);
      setLocalChanges({});
      toast.success('Permissões atualizadas com sucesso!');
    } catch {
      toast.error('Erro ao salvar permissões');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTabChange = (tab: string) => {
    if (hasChanges) {
      if (!window.confirm('Você tem alterações não salvas. Deseja descartar?')) return;
    }
    setLocalChanges({});
    setActiveTab(tab);
    setSearchQuery('');
  };

  const toggleRoleFilter = (role: string) => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  // Summary cards data
  const roleSummary = useMemo(() => {
    return visibleRoles.filter(r => r !== 'admin').map(role => {
      const total = resources.length;
      const withAccess = resources.filter(res => {
        const level = getCurrentValue(role, res);
        return level !== 'none';
      }).length;
      return { role, total, withAccess };
    });
  }, [visibleRoles, resources, permissionsMap, localChanges]);

  // Copy permissions handler
  const handleCopyPermissions = () => {
    if (!copySource || !copyTarget || copySource === copyTarget) return;
    const newChanges = { ...localChanges };
    if (!newChanges[copyTarget]) newChanges[copyTarget] = {};
    resources.forEach(resource => {
      const sourceVal = getCurrentValue(copySource as AppRole, resource);
      newChanges[copyTarget][resource] = sourceVal;
    });
    setLocalChanges(newChanges);
    setCopyModalOpen(false);
    setCopySource('');
    setCopyTarget('');
    toast.info(`Permissões copiadas de ${ROLE_LABELS_MAP[copySource as AppRole]} para ${ROLE_LABELS_MAP[copyTarget as AppRole]}. Salve para aplicar.`);
  };

  if (isLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Permissões por Cargo
            </h1>
            <p className="text-muted-foreground">
              Configure quais recursos cada cargo pode acessar, por contexto global ou por BU
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCopyModalOpen(true)}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar de...
            </Button>
            {hasChanges && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Alterações
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar recurso..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="show-admin"
              checked={showAdmin}
              onCheckedChange={(v) => setShowAdmin(!!v)}
            />
            <label htmlFor="show-admin" className="text-muted-foreground cursor-pointer">
              Mostrar Admin
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {ALL_ROLES.filter(r => showAdmin || r !== 'admin').map(role => (
              <Badge
                key={role}
                variant={selectedRoles.has(role) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleRoleFilter(role)}
              >
                {ROLE_LABELS_MAP[role]}
              </Badge>
            ))}
            {selectedRoles.size > 0 && (
              <Badge
                variant="outline"
                className="cursor-pointer text-xs text-destructive border-destructive/30"
                onClick={() => setSelectedRoles(new Set())}
              >
                Limpar
              </Badge>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {roleSummary.map(({ role, total, withAccess }) => {
            const pct = total > 0 ? withAccess / total : 0;
            const colorClass = pct >= 0.7 ? 'border-green-500/40' : pct >= 0.3 ? 'border-yellow-500/40' : 'border-destructive/40';
            const isSelected = selectedRoles.has(role);
            return (
              <Card
                key={role}
                className={`cursor-pointer transition-all hover:scale-[1.02] ${colorClass} ${isSelected ? 'ring-2 ring-primary' : ''}`}
                onClick={() => toggleRoleFilter(role)}
              >
                <CardContent className="p-3 text-center">
                  <p className="text-xs font-medium truncate">{ROLE_LABELS_MAP[role as AppRole]}</p>
                  <p className="text-lg font-bold">{withAccess}<span className="text-xs text-muted-foreground font-normal">/{total}</span></p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs + Table */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex-wrap h-auto gap-1">
            {BU_TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {BU_TABS.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>
                    {tab.value === '__global__' ? 'Permissões Globais' : `Permissões — ${tab.label}`}
                  </CardTitle>
                  <CardDescription>
                    {tab.value === '__global__'
                      ? 'Permissões que valem para todos os contextos (Dashboard, Relatórios, Configurações, etc.)'
                      : `Permissões específicas para a BU ${tab.label} (CRM, Fechamento, etc.)`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">
                          Recurso
                        </TableHead>
                        {visibleRoles.map(role => (
                          <TableHead key={role} className="text-center min-w-[120px]">
                            {ROLE_LABELS_MAP[role]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResources.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={visibleRoles.length + 1} className="text-center text-muted-foreground py-8">
                            Nenhum recurso encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredResources.map(resource => {
                          const hasOverrideFlag = activeTab === '__global__' && resourceHasOverride(resource);
                          return (
                            <TableRow key={resource}>
                              <TableCell className="sticky left-0 bg-background z-10 font-medium">
                                <div className="flex items-center gap-1.5">
                                  {RESOURCE_LABELS[resource] || resource}
                                  {hasOverrideFlag && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Layers className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Há permissões específicas por BU para este recurso
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                              {visibleRoles.map(role => {
                                const currentValue = getCurrentValue(role, resource);
                                const isAdminRole = role === 'admin';
                                const hasLocalChange = localChanges[role]?.[resource] !== undefined;

                                return (
                                  <TableCell key={`${role}-${resource}`} className="text-center p-2">
                                    {isAdminRole ? (
                                      <Badge className={`${PERMISSION_COLORS.full} border`}>
                                        {PERMISSION_LABELS.full}
                                      </Badge>
                                    ) : (
                                      <Select
                                        value={currentValue}
                                        onValueChange={(value) => handleChange(role, resource, value as PermissionLevel)}
                                      >
                                        <SelectTrigger
                                          className={`w-[100px] h-8 text-xs mx-auto ${hasLocalChange ? 'ring-2 ring-primary' : ''}`}
                                        >
                                          <SelectValue>
                                            <Badge variant="outline" className={`${PERMISSION_COLORS[currentValue]} border text-xs`}>
                                              {PERMISSION_LABELS[currentValue]}
                                            </Badge>
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {PERMISSION_LEVELS.map(level => (
                                            <SelectItem key={level} value={level}>
                                              <Badge variant="outline" className={`${PERMISSION_COLORS[level]} border`}>
                                                {PERMISSION_LABELS[level]}
                                              </Badge>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle>Legenda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {PERMISSION_LEVELS.map(level => (
                <div key={level} className="flex items-center gap-2">
                  <Badge variant="outline" className={`${PERMISSION_COLORS[level]} border`}>
                    {PERMISSION_LABELS[level]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {level === 'none' && '- Sem acesso'}
                    {level === 'view' && '- Pode visualizar'}
                    {level === 'edit' && '- Pode editar'}
                    {level === 'full' && '- Acesso total'}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-muted-foreground">- Override por BU configurado</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Copy Modal */}
        <Dialog open={copyModalOpen} onOpenChange={setCopyModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copiar permissões de outro cargo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Cargo origem</label>
                <Select value={copySource} onValueChange={setCopySource}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.filter(r => r !== 'admin').map(r => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS_MAP[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Cargo destino</label>
                <Select value={copyTarget} onValueChange={setCopyTarget}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.filter(r => r !== 'admin' && r !== copySource).map(r => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS_MAP[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                As permissões serão copiadas como alterações locais na aba "{BU_TABS.find(t => t.value === activeTab)?.label}". Você ainda precisará salvar.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCopyModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleCopyPermissions} disabled={!copySource || !copyTarget}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
