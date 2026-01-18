import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCRMPermissionsAdmin } from '@/hooks/useCRMPermissionsAdmin';
import { Loader2, Save, Shield, Layers, GitBranch, Eye, Edit, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface CRMPermissionsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'sdr', label: 'SDR' },
  { value: 'closer', label: 'Closer' },
  { value: 'viewer', label: 'Visualizador' },
];

export const CRMPermissionsManager = ({ open, onOpenChange }: CRMPermissionsManagerProps) => {
  const [selectedRole, setSelectedRole] = useState('sdr');
  const [activeTab, setActiveTab] = useState('groups');
  const [pendingChanges, setPendingChanges] = useState<Map<string, { canView: boolean; canEdit: boolean }>>(new Map());
  const [pendingStageChanges, setPendingStageChanges] = useState<Map<string, { canView: boolean; canEdit: boolean; canMoveFrom: boolean; canMoveTo: boolean }>>(new Map());

  const {
    groups,
    origins,
    stages,
    isLoading,
    getGroupPermission,
    getOriginPermission,
    getStagePermission,
    upsertGroupPermission,
    upsertOriginPermission,
    upsertStagePermission,
  } = useCRMPermissionsAdmin();

  const handleGroupPermissionChange = (groupId: string, field: 'canView' | 'canEdit', value: boolean) => {
    const existing = pendingChanges.get(groupId) || {
      canView: getGroupPermission(selectedRole, groupId)?.can_view ?? false,
      canEdit: getGroupPermission(selectedRole, groupId)?.can_edit ?? false,
    };
    
    setPendingChanges(new Map(pendingChanges.set(groupId, {
      ...existing,
      [field]: value,
    })));
  };

  const handleOriginPermissionChange = (originId: string, field: 'canView' | 'canEdit', value: boolean) => {
    const existing = pendingChanges.get(`origin_${originId}`) || {
      canView: getOriginPermission(selectedRole, originId)?.can_view ?? false,
      canEdit: getOriginPermission(selectedRole, originId)?.can_edit ?? false,
    };
    
    setPendingChanges(new Map(pendingChanges.set(`origin_${originId}`, {
      ...existing,
      [field]: value,
    })));
  };

  const handleStagePermissionChange = (stageId: string, field: 'canView' | 'canEdit' | 'canMoveFrom' | 'canMoveTo', value: boolean) => {
    const existing = pendingStageChanges.get(stageId) || {
      canView: getStagePermission(selectedRole, stageId)?.can_view ?? false,
      canEdit: getStagePermission(selectedRole, stageId)?.can_edit ?? false,
      canMoveFrom: getStagePermission(selectedRole, stageId)?.can_move_from ?? false,
      canMoveTo: getStagePermission(selectedRole, stageId)?.can_move_to ?? false,
    };
    
    setPendingStageChanges(new Map(pendingStageChanges.set(stageId, {
      ...existing,
      [field]: value,
    })));
  };

  const saveChanges = async () => {
    try {
      // Salvar permissões de grupos
      for (const [key, value] of pendingChanges.entries()) {
        if (key.startsWith('origin_')) {
          const originId = key.replace('origin_', '');
          await upsertOriginPermission.mutateAsync({
            role: selectedRole,
            originId,
            canView: value.canView,
            canEdit: value.canEdit,
          });
        } else {
          await upsertGroupPermission.mutateAsync({
            role: selectedRole,
            groupId: key,
            canView: value.canView,
            canEdit: value.canEdit,
          });
        }
      }

      // Salvar permissões de estágios
      for (const [stageId, value] of pendingStageChanges.entries()) {
        await upsertStagePermission.mutateAsync({
          role: selectedRole,
          stageUuid: stageId,
          canView: value.canView,
          canEdit: value.canEdit,
          canMoveFrom: value.canMoveFrom,
          canMoveTo: value.canMoveTo,
        });
      }

      setPendingChanges(new Map());
      setPendingStageChanges(new Map());
      toast.success('Permissões salvas com sucesso!');
    } catch (error) {
      console.error('Error saving permissions:', error);
    }
  };

  const getGroupValue = (groupId: string, field: 'canView' | 'canEdit') => {
    const pending = pendingChanges.get(groupId);
    if (pending) return pending[field];
    const perm = getGroupPermission(selectedRole, groupId);
    return field === 'canView' ? (perm?.can_view ?? false) : (perm?.can_edit ?? false);
  };

  const getOriginValue = (originId: string, field: 'canView' | 'canEdit') => {
    const pending = pendingChanges.get(`origin_${originId}`);
    if (pending) return pending[field];
    const perm = getOriginPermission(selectedRole, originId);
    return field === 'canView' ? (perm?.can_view ?? false) : (perm?.can_edit ?? false);
  };

  const getStageValue = (stageId: string, field: 'canView' | 'canEdit' | 'canMoveFrom' | 'canMoveTo') => {
    const pending = pendingStageChanges.get(stageId);
    if (pending) return pending[field];
    const perm = getStagePermission(selectedRole, stageId);
    switch (field) {
      case 'canView': return perm?.can_view ?? false;
      case 'canEdit': return perm?.can_edit ?? false;
      case 'canMoveFrom': return perm?.can_move_from ?? false;
      case 'canMoveTo': return perm?.can_move_to ?? false;
    }
  };

  const hasChanges = pendingChanges.size > 0 || pendingStageChanges.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gerenciar Permissões do CRM
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seletor de Role */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Função:</span>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasChanges && (
              <Badge variant="secondary" className="ml-auto">
                Alterações pendentes
              </Badge>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="groups" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Grupos/Pipelines
              </TabsTrigger>
              <TabsTrigger value="origins" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Origens
              </TabsTrigger>
              <TabsTrigger value="stages" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Estágios
              </TabsTrigger>
            </TabsList>

            {/* Tab Grupos */}
            <TabsContent value="groups">
              <ScrollArea className="h-[400px] border rounded-md p-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr,80px,80px] gap-2 mb-4 pb-2 border-b text-sm font-medium text-muted-foreground">
                      <span>Grupo</span>
                      <span className="text-center">Ver</span>
                      <span className="text-center">Editar</span>
                    </div>
                    {groups.map(group => (
                      <div key={group.id} className="grid grid-cols-[1fr,80px,80px] gap-2 items-center py-2 hover:bg-muted/50 rounded px-2">
                        <span className="text-sm truncate">{group.display_name || group.name}</span>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={getGroupValue(group.id, 'canView')}
                            onCheckedChange={(checked) => handleGroupPermissionChange(group.id, 'canView', checked as boolean)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={getGroupValue(group.id, 'canEdit')}
                            onCheckedChange={(checked) => handleGroupPermissionChange(group.id, 'canEdit', checked as boolean)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Tab Origens */}
            <TabsContent value="origins">
              <ScrollArea className="h-[400px] border rounded-md p-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr,80px,80px] gap-2 mb-4 pb-2 border-b text-sm font-medium text-muted-foreground">
                      <span>Origem</span>
                      <span className="text-center">Ver</span>
                      <span className="text-center">Editar</span>
                    </div>
                    {origins.map(origin => (
                      <div key={origin.id} className="grid grid-cols-[1fr,80px,80px] gap-2 items-center py-2 hover:bg-muted/50 rounded px-2">
                        <span className="text-sm truncate">{origin.display_name || origin.name}</span>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={getOriginValue(origin.id, 'canView')}
                            onCheckedChange={(checked) => handleOriginPermissionChange(origin.id, 'canView', checked as boolean)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={getOriginValue(origin.id, 'canEdit')}
                            onCheckedChange={(checked) => handleOriginPermissionChange(origin.id, 'canEdit', checked as boolean)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Tab Estágios */}
            <TabsContent value="stages">
              <ScrollArea className="h-[400px] border rounded-md p-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr,60px,60px,60px,60px] gap-2 mb-4 pb-2 border-b text-sm font-medium text-muted-foreground">
                      <span>Estágio</span>
                      <span className="text-center flex items-center justify-center gap-1">
                        <Eye className="h-3 w-3" /> Ver
                      </span>
                      <span className="text-center flex items-center justify-center gap-1">
                        <Edit className="h-3 w-3" /> Edit
                      </span>
                      <span className="text-center flex items-center justify-center gap-1">
                        <ArrowLeft className="h-3 w-3" /> De
                      </span>
                      <span className="text-center flex items-center justify-center gap-1">
                        <ArrowRight className="h-3 w-3" /> Para
                      </span>
                    </div>
                    {stages.map(stage => (
                      <div key={stage.id} className="grid grid-cols-[1fr,60px,60px,60px,60px] gap-2 items-center py-2 hover:bg-muted/50 rounded px-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: stage.color || '#6b7280' }} 
                          />
                          <span className="text-sm truncate">{stage.stage_name}</span>
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={getStageValue(stage.id, 'canView')}
                            onCheckedChange={(checked) => handleStagePermissionChange(stage.id, 'canView', checked as boolean)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={getStageValue(stage.id, 'canEdit')}
                            onCheckedChange={(checked) => handleStagePermissionChange(stage.id, 'canEdit', checked as boolean)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={getStageValue(stage.id, 'canMoveFrom')}
                            onCheckedChange={(checked) => handleStagePermissionChange(stage.id, 'canMoveFrom', checked as boolean)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={getStageValue(stage.id, 'canMoveTo')}
                            onCheckedChange={(checked) => handleStagePermissionChange(stage.id, 'canMoveTo', checked as boolean)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Botão Salvar */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={saveChanges} 
              disabled={!hasChanges || upsertGroupPermission.isPending}
            >
              {upsertGroupPermission.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Permissões
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
