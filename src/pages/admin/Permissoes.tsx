import { useState } from 'react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionLevel, AppRole, ResourceType, RESOURCE_LABELS } from '@/types/user-management';

const ROLES: AppRole[] = ['admin', 'manager', 'coordenador', 'sdr', 'closer', 'closer_sombra', 'financeiro', 'rh', 'gr', 'viewer'];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  coordenador: 'Coordenador',
  sdr: 'SDR',
  closer: 'Closer',
  closer_sombra: 'Closer Sombra',
  financeiro: 'Financeiro',
  rh: 'RH',
  gr: 'Gerente de Conta',
  viewer: 'Viewer',
};

const RESOURCES: ResourceType[] = [
  'dashboard',
  'receita',
  'custos',
  'relatorios',
  'alertas',
  'crm',
  'fechamento_sdr',
  'usuarios',
  'financeiro',
  'projetos',
  'credito',
  'leilao',
  'configuracoes',
  'efeito_alavanca',
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
  const { permissionsMap, isLoading, updatePermissions } = useRolePermissions();
  const [localChanges, setLocalChanges] = useState<Record<string, Record<string, PermissionLevel>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const getCurrentValue = (role: AppRole, resource: ResourceType): PermissionLevel => {
    // Check local changes first
    if (localChanges[role]?.[resource]) {
      return localChanges[role][resource];
    }
    // Then check database
    return permissionsMap[role]?.[resource] || 'none';
  };

  const handleChange = (role: AppRole, resource: ResourceType, value: PermissionLevel) => {
    setLocalChanges(prev => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        [resource]: value,
      },
    }));
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: { role: string; resource: string; permissionLevel: PermissionLevel }[] = [];
      
      Object.entries(localChanges).forEach(([role, resources]) => {
        Object.entries(resources).forEach(([resource, level]) => {
          updates.push({
            role,
            resource,
            permissionLevel: level,
          });
        });
      });

      await updatePermissions.mutateAsync(updates);
      setLocalChanges({});
      toast.success('Permissões atualizadas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar permissões');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Permissões por Cargo
          </h1>
          <p className="text-muted-foreground">
            Configure quais recursos cada cargo pode acessar
          </p>
        </div>
        
        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matriz de Permissões</CardTitle>
          <CardDescription>
            Clique em qualquer célula para alterar o nível de permissão
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[150px]">
                  Recurso
                </TableHead>
                {ROLES.map(role => (
                  <TableHead key={role} className="text-center min-w-[120px]">
                    {ROLE_LABELS[role]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {RESOURCES.map(resource => (
                <TableRow key={resource}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">
                    {RESOURCE_LABELS[resource] || resource}
                  </TableCell>
                  {ROLES.map(role => {
                    const currentValue = getCurrentValue(role, resource);
                    const isAdmin = role === 'admin';
                    const hasLocalChange = localChanges[role]?.[resource] !== undefined;

                    return (
                      <TableCell key={`${role}-${resource}`} className="text-center p-2">
                        {isAdmin ? (
                          <Badge className={`${PERMISSION_COLORS.full} border`}>
                            {PERMISSION_LABELS.full}
                          </Badge>
                        ) : (
                          <Select
                            value={currentValue}
                            onValueChange={(value) => handleChange(role, resource, value as PermissionLevel)}
                          >
                            <SelectTrigger 
                              className={`w-[100px] h-8 text-xs mx-auto ${
                                hasLocalChange ? 'ring-2 ring-primary' : ''
                              }`}
                            >
                              <SelectValue>
                                <Badge 
                                  variant="outline" 
                                  className={`${PERMISSION_COLORS[currentValue]} border text-xs`}
                                >
                                  {PERMISSION_LABELS[currentValue]}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {PERMISSION_LEVELS.map(level => (
                                <SelectItem key={level} value={level}>
                                  <Badge 
                                    variant="outline" 
                                    className={`${PERMISSION_COLORS[level]} border`}
                                  >
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
