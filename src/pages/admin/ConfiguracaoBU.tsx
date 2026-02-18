import { useState, useMemo, useEffect } from 'react';
import { Building2, Save, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCRMPipelines } from '@/components/crm/PipelineSelector';
import { useBUOriginMapping, useSaveBUOriginMapping } from '@/hooks/useBUOriginMapping';
import { BusinessUnit } from '@/hooks/useMyBU';

const BU_OPTIONS: { value: BusinessUnit; label: string }[] = [
  { value: 'incorporador', label: 'BU - Incorporador MCF' },
  { value: 'consorcio', label: 'BU - Consórcio' },
  { value: 'credito', label: 'BU - Crédito' },
  { value: 'projetos', label: 'BU - Projetos' },
  { value: 'leilao', label: 'BU - Leilão' },
  { value: 'marketing', label: 'BU - Marketing' },
];

export default function ConfiguracaoBU() {
  const [selectedBU, setSelectedBU] = useState<BusinessUnit>('incorporador');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [defaultGroup, setDefaultGroup] = useState<string | null>(null);
  
  // Buscar grupos/funis disponíveis
  const { data: pipelines, isLoading: pipelinesLoading } = useCRMPipelines();
  
  // Buscar mapeamento atual da BU selecionada
  const { data: currentMapping, isLoading: mappingLoading } = useBUOriginMapping(selectedBU);
  
  // Mutation para salvar
  const saveMutation = useSaveBUOriginMapping();
  
  // Sincronizar estado local quando o mapeamento carrega
  useEffect(() => {
    if (currentMapping) {
      const groupIds = currentMapping
        .filter(m => m.entity_type === 'group')
        .map(m => m.entity_id);
      setSelectedGroups(new Set(groupIds));
      
      const defaultGroupEntry = currentMapping.find(m => m.entity_type === 'group' && m.is_default);
      setDefaultGroup(defaultGroupEntry?.entity_id || null);
    } else {
      setSelectedGroups(new Set());
      setDefaultGroup(null);
    }
  }, [currentMapping]);
  
  // Reset ao trocar BU
  useEffect(() => {
    setSelectedGroups(new Set());
    setDefaultGroup(null);
  }, [selectedBU]);
  
  // Toggle grupo
  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
        // Se removeu o grupo padrão, limpar
        if (defaultGroup === groupId) {
          setDefaultGroup(null);
        }
      } else {
        next.add(groupId);
      }
      return next;
    });
  };
  
  // Definir como padrão
  const setAsDefault = (groupId: string) => {
    if (selectedGroups.has(groupId)) {
      setDefaultGroup(groupId);
    }
  };
  
  // Salvar configuração
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
    
    const currentGroupIds = new Set(
      currentMapping.filter(m => m.entity_type === 'group').map(m => m.entity_id)
    );
    const currentDefault = currentMapping.find(m => m.entity_type === 'group' && m.is_default)?.entity_id;
    
    // Verificar se grupos são diferentes
    if (selectedGroups.size !== currentGroupIds.size) return true;
    for (const id of selectedGroups) {
      if (!currentGroupIds.has(id)) return true;
    }
    
    // Verificar se default é diferente
    if (defaultGroup !== currentDefault) return true;
    
    return false;
  }, [currentMapping, selectedGroups, defaultGroup]);
  
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
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecione a Business Unit</CardTitle>
          <CardDescription>
            Escolha a BU e marque os funis que devem aparecer para os usuários dessa unidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seletor de BU */}
          <div className="space-y-2">
            <Label>Business Unit</Label>
            <Select
              value={selectedBU}
              onValueChange={(v) => setSelectedBU(v as BusinessUnit)}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BU_OPTIONS.map(bu => (
                  <SelectItem key={bu.value} value={bu.value}>
                    {bu.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Lista de Grupos/Funis */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Funis Vinculados</Label>
            <p className="text-sm text-muted-foreground">
              Marque os funis que devem aparecer para usuários da BU <strong>{BU_OPTIONS.find(b => b.value === selectedBU)?.label}</strong>
            </p>
            
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {pipelines?.map(pipeline => {
                  const isChecked = selectedGroups.has(pipeline.id);
                  const isDefault = defaultGroup === pipeline.id;
                  
                  return (
                    <div 
                      key={pipeline.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={pipeline.id}
                          checked={isChecked}
                          onCheckedChange={() => toggleGroup(pipeline.id)}
                        />
                        <label 
                          htmlFor={pipeline.id}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {pipeline.display_name || pipeline.name}
                        </label>
                        {isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Padrão
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          {pipeline.id.slice(0, 8)}...
                        </span>
                        {isChecked && !isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAsDefault(pipeline.id)}
                            className="text-xs h-7"
                          >
                            Definir como padrão
                          </Button>
                        )}
                        {isDefault && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {(!pipelines || pipelines.length === 0) && (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    Nenhum funil encontrado
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Resumo */}
          {selectedGroups.size > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">
                Resumo: {selectedGroups.size} funil(is) selecionado(s)
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from(selectedGroups).map(id => {
                  const pipeline = pipelines?.find(p => p.id === id);
                  return (
                    <Badge 
                      key={id} 
                      variant={defaultGroup === id ? 'default' : 'outline'}
                    >
                      {pipeline?.display_name || pipeline?.name || id.slice(0, 8)}
                      {defaultGroup === id && ' ★'}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Botão Salvar */}
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
    </div>
  );
}
