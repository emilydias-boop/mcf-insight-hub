import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { QualificationFieldEditor } from './QualificationFieldEditor';
import { QUALIFICATION_FIELDS, QualificationField } from './qualification/QualificationFields';
import {
  useQualificationFieldConfigs,
  useSaveQualificationFieldConfig,
  useDeleteQualificationFieldConfig,
} from '@/hooks/useQualificationFieldConfigs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Save } from 'lucide-react';

interface QualificationFieldsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QualificationFieldsManager({ open, onOpenChange }: QualificationFieldsManagerProps) {
  const [activeTab, setActiveTab] = useState<'global' | 'group' | 'origin'>('global');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);
  const [fields, setFields] = useState<QualificationField[]>(QUALIFICATION_FIELDS);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: configs, isLoading: configsLoading } = useQualificationFieldConfigs();
  const saveConfig = useSaveQualificationFieldConfig();
  const deleteConfig = useDeleteQualificationFieldConfig();

  // Fetch groups
  const { data: groups } = useQuery({
    queryKey: ['crm-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_groups')
        .select('id, name, display_name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch origins
  const { data: origins } = useQuery({
    queryKey: ['crm-origins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_origins')
        .select('id, name, display_name, group_id')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Load config when tab/selection changes
  useEffect(() => {
    if (!configs) return;

    let config = null;

    if (activeTab === 'global') {
      config = configs.find(c => c.scope_type === 'global');
    } else if (activeTab === 'group' && selectedGroupId) {
      config = configs.find(c => c.scope_type === 'group' && c.group_id === selectedGroupId);
    } else if (activeTab === 'origin' && selectedOriginId) {
      config = configs.find(c => c.scope_type === 'origin' && c.origin_id === selectedOriginId);
    }

    if (config && config.fields.length > 0) {
      setFields(config.fields);
    } else {
      setFields(QUALIFICATION_FIELDS);
    }
    setHasChanges(false);
  }, [activeTab, selectedGroupId, selectedOriginId, configs]);

  const handleFieldsChange = (newFields: QualificationField[]) => {
    setFields(newFields);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await saveConfig.mutateAsync({
        scopeType: activeTab,
        groupId: activeTab === 'group' ? selectedGroupId : null,
        originId: activeTab === 'origin' ? selectedOriginId : null,
        fields,
      });
      toast.success('Configuração salva com sucesso!');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configuração');
    }
  };

  const handleResetToDefault = () => {
    setFields(QUALIFICATION_FIELDS);
    setHasChanges(true);
  };

  const handleDeleteConfig = async () => {
    if (!configs) return;

    let config = null;
    if (activeTab === 'global') {
      config = configs.find(c => c.scope_type === 'global');
    } else if (activeTab === 'group' && selectedGroupId) {
      config = configs.find(c => c.scope_type === 'group' && c.group_id === selectedGroupId);
    } else if (activeTab === 'origin' && selectedOriginId) {
      config = configs.find(c => c.scope_type === 'origin' && c.origin_id === selectedOriginId);
    }

    if (config) {
      try {
        await deleteConfig.mutateAsync(config.id);
        toast.success('Configuração removida. Usando campos padrão.');
        setFields(QUALIFICATION_FIELDS);
        setHasChanges(false);
      } catch (error) {
        console.error('Error deleting config:', error);
        toast.error('Erro ao remover configuração');
      }
    }
  };

  const filteredOrigins = selectedGroupId 
    ? origins?.filter(o => o.group_id === selectedGroupId)
    : origins;

  const currentConfig = configs?.find(c => {
    if (activeTab === 'global') return c.scope_type === 'global';
    if (activeTab === 'group' && selectedGroupId) return c.scope_type === 'group' && c.group_id === selectedGroupId;
    if (activeTab === 'origin' && selectedOriginId) return c.scope_type === 'origin' && c.origin_id === selectedOriginId;
    return false;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Campos de Qualificação</DialogTitle>
        </DialogHeader>

        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as 'global' | 'group' | 'origin')}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="global">Padrão</TabsTrigger>
            <TabsTrigger value="group">Por Grupo</TabsTrigger>
            <TabsTrigger value="origin">Por Origem</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="flex-1 overflow-auto space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Configure os campos padrão de qualificação que serão usados quando não houver configuração específica.
            </p>
            <QualificationFieldEditor fields={fields} onChange={handleFieldsChange} />
          </TabsContent>

          <TabsContent value="group" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Selecione o Grupo</Label>
              <Select
                value={selectedGroupId || ''}
                onValueChange={(v) => {
                  setSelectedGroupId(v || null);
                  setSelectedOriginId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um grupo..." />
                </SelectTrigger>
                <SelectContent>
                  {groups?.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.display_name || group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedGroupId ? (
              <QualificationFieldEditor fields={fields} onChange={handleFieldsChange} />
            ) : (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                Selecione um grupo para configurar os campos.
              </div>
            )}
          </TabsContent>

          <TabsContent value="origin" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grupo (opcional)</Label>
                <Select
                  value={selectedGroupId || ''}
                  onValueChange={(v) => {
                    setSelectedGroupId(v || null);
                    setSelectedOriginId(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por grupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os grupos</SelectItem>
                    {groups?.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.display_name || group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Origem</Label>
                <Select
                  value={selectedOriginId || ''}
                  onValueChange={(v) => setSelectedOriginId(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma origem..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredOrigins?.map((origin) => (
                      <SelectItem key={origin.id} value={origin.id}>
                        {origin.display_name || origin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedOriginId ? (
              <QualificationFieldEditor fields={fields} onChange={handleFieldsChange} />
            ) : (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                Selecione uma origem para configurar os campos.
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-shrink-0 flex items-center justify-between border-t pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleResetToDefault}
              disabled={saveConfig.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Padrão
            </Button>
            {currentConfig && (
              <Button
                variant="ghost"
                onClick={handleDeleteConfig}
                disabled={deleteConfig.isPending}
                className="text-destructive"
              >
                Remover Config
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveConfig.isPending || (activeTab === 'group' && !selectedGroupId) || (activeTab === 'origin' && !selectedOriginId)}
            >
              {saveConfig.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
