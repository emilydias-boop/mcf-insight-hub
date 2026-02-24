import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, GripVertical, Trash2, Pencil, Check, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';

interface PipelineStagesEditorProps {
  targetType: 'origin' | 'group';
  targetId: string;
}

type StageType = 'normal' | 'won' | 'lost';

interface LocalStage {
  id: string;
  name: string;
  color: string;
  stage_type: StageType;
  stage_order: number;
}

const stageColors = [
  { value: '#6b7280', label: 'Cinza' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#14b8a6', label: 'Teal' },
];

export const PipelineStagesEditor = ({ targetType, targetId }: PipelineStagesEditorProps) => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; color: string; stage_type: StageType }>({ 
    name: '', 
    color: '', 
    stage_type: 'normal' 
  });
  const [newStage, setNewStage] = useState<{ name: string; color: string; stage_type: StageType }>({ 
    name: '', 
    color: '#6b7280', 
    stage_type: 'normal' 
  });
  const [showNewForm, setShowNewForm] = useState(false);

  // Fetch local stages
  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['local-pipeline-stages', targetType, targetId],
    queryFn: async () => {
      const column = targetType === 'origin' ? 'origin_id' : 'group_id';
      const { data, error } = await supabase
        .from('local_pipeline_stages')
        .select('*')
        .eq(column, targetId)
        .order('stage_order');
      if (error) throw error;
      return data as LocalStage[];
    },
  });

  // Create stage mutation
  const createMutation = useMutation({
    mutationFn: async (stage: Omit<LocalStage, 'id' | 'stage_order'>) => {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.stage_order)) : -1;
      const column = targetType === 'origin' ? 'origin_id' : 'group_id';
      
      // 1. Criar em local_pipeline_stages
      const { data: createdStage, error } = await supabase
        .from('local_pipeline_stages')
        .insert({
          [column]: targetId,
          name: stage.name,
          color: stage.color,
          stage_type: stage.stage_type,
          stage_order: maxOrder + 1,
        })
        .select('id')
        .single();
      if (error) throw error;
      
      // 2. Espelhar em crm_stages (OBRIGATÓRIO para evitar erro de FK ao mover deals)
      if (createdStage) {
        const originId = targetType === 'origin' ? targetId : null;
        if (originId) {
          const { error: mirrorError } = await supabase
            .from('crm_stages')
            .upsert({
              id: createdStage.id,
              clint_id: `local-${createdStage.id}`,
              stage_name: stage.name,
              color: stage.color,
              stage_order: maxOrder + 1,
              origin_id: originId,
              is_active: true,
            }, { onConflict: 'id' });
          if (mirrorError) {
            // Fatal: deletar o local stage se não conseguiu espelhar
            console.error('[PipelineStagesEditor] Erro FATAL ao espelhar em crm_stages:', mirrorError.message);
            await supabase.from('local_pipeline_stages').delete().eq('id', createdStage.id);
            throw new Error(`Erro ao sincronizar etapa: ${mirrorError.message}`);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Etapa criada!');
      queryClient.invalidateQueries({ queryKey: ['local-pipeline-stages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      setShowNewForm(false);
      setNewStage({ name: '', color: '#6b7280', stage_type: 'normal' });
    },
    onError: (error) => {
      toast.error('Erro ao criar etapa: ' + (error as Error).message);
    },
  });

  // Update stage mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LocalStage> & { id: string }) => {
      // 1. Atualizar em local_pipeline_stages
      const { error } = await supabase
        .from('local_pipeline_stages')
        .update(updates)
        .eq('id', id);
      if (error) throw error;

      // 2. Espelhar em crm_stages (não-fatal)
      const crmUpdates: any = {};
      if (updates.name) crmUpdates.stage_name = updates.name;
      if (updates.color) crmUpdates.color = updates.color;
      if (updates.stage_type) crmUpdates.stage_type = updates.stage_type;
      if (Object.keys(crmUpdates).length > 0) {
        const { error: mirrorError } = await supabase
          .from('crm_stages')
          .update(crmUpdates)
          .eq('id', id);
        if (mirrorError) {
          console.warn('[PipelineStagesEditor] Erro ao espelhar update em crm_stages:', mirrorError.message);
        }
      }
    },
    onSuccess: () => {
      toast.success('Etapa atualizada!');
      queryClient.invalidateQueries({ queryKey: ['local-pipeline-stages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      setEditingId(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + (error as Error).message);
    },
  });

  // Delete stage mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Deletar de local_pipeline_stages
      const { error } = await supabase
        .from('local_pipeline_stages')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // 2. Marcar como is_active = false em crm_stages (não-fatal, preserva FK)
      const { error: mirrorError } = await supabase
        .from('crm_stages')
        .update({ is_active: false })
        .eq('id', id);
      if (mirrorError) {
        console.warn('[PipelineStagesEditor] Erro ao desativar em crm_stages:', mirrorError.message);
      }
    },
    onSuccess: () => {
      toast.success('Etapa removida!');
      queryClient.invalidateQueries({ queryKey: ['local-pipeline-stages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + (error as Error).message);
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        stage_order: index,
      }));

      for (const update of updates) {
        // 1. Atualizar em local_pipeline_stages
        const { error } = await supabase
          .from('local_pipeline_stages')
          .update({ stage_order: update.stage_order })
          .eq('id', update.id);
        if (error) throw error;

        // 2. Espelhar ordem em crm_stages (não-fatal)
        const { error: mirrorError } = await supabase
          .from('crm_stages')
          .update({ stage_order: update.stage_order })
          .eq('id', update.id);
        if (mirrorError) {
          console.warn('[PipelineStagesEditor] Erro ao espelhar reorder em crm_stages:', mirrorError.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-pipeline-stages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
    },
    onError: (error) => {
      toast.error('Erro ao reordenar: ' + (error as Error).message);
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    reorderMutation.mutate(items.map(s => s.id));
  };

  const startEditing = (stage: LocalStage) => {
    setEditingId(stage.id);
    setEditForm({ name: stage.name, color: stage.color, stage_type: stage.stage_type });
  };

  const saveEdit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...editForm });
    }
  };

  const handleCreateStage = () => {
    if (!newStage.name.trim()) {
      toast.error('Nome da etapa é obrigatório');
      return;
    }
    createMutation.mutate(newStage);
  };

  const getStageTypeBadge = (type: string) => {
    switch (type) {
      case 'won':
        return <Badge className="bg-green-600">Ganho</Badge>;
      case 'lost':
        return <Badge variant="destructive">Perdido</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando etapas...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Etapas do Kanban</h3>
          <p className="text-sm text-muted-foreground">
            Arraste para reordenar. Clique para editar.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewForm(true)}
          disabled={showNewForm}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nova Etapa
        </Button>
      </div>

      {/* New stage form */}
      {showNewForm && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={newStage.name}
                onChange={(e) => setNewStage(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome da etapa"
              />
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <Select
                value={newStage.color}
                onValueChange={(v) => setNewStage(prev => ({ ...prev, color: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stageColors.map(color => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: color.value }}
                        />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={newStage.stage_type}
                onValueChange={(v) => setNewStage(prev => ({ ...prev, stage_type: v as StageType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="won">Ganho</SelectItem>
                  <SelectItem value="lost">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateStage} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : 'Criar'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowNewForm(false);
                setNewStage({ name: '', color: '#6b7280', stage_type: 'normal' });
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Stages list */}
      {stages.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <p>Nenhuma etapa local configurada.</p>
          <p className="text-sm">As etapas padrão do sistema serão usadas.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="stages">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {stages.map((stage, index) => (
                  <Draggable key={stage.id} draggableId={stage.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          'flex items-center gap-3 p-3 border rounded-lg bg-background',
                          snapshot.isDragging && 'shadow-lg'
                        )}
                      >
                        <div {...provided.dragHandleProps} className="cursor-grab">
                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                        </div>

                        <div
                          className="w-4 h-4 rounded flex-shrink-0"
                          style={{ backgroundColor: stage.color }}
                        />

                        {editingId === stage.id ? (
                          <>
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              className="flex-1 h-8"
                            />
                            <Select
                              value={editForm.color}
                              onValueChange={(v) => setEditForm(prev => ({ ...prev, color: v }))}
                            >
                              <SelectTrigger className="w-24 h-8">
                                <div
                                  className="w-4 h-4 rounded"
                                  style={{ backgroundColor: editForm.color }}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {stageColors.map(color => (
                                  <SelectItem key={color.value} value={color.value}>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-4 h-4 rounded"
                                        style={{ backgroundColor: color.value }}
                                      />
                                      {color.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={editForm.stage_type}
                              onValueChange={(v) => setEditForm(prev => ({ ...prev, stage_type: v as StageType }))}
                            >
                              <SelectTrigger className="w-24 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="won">Ganho</SelectItem>
                                <SelectItem value="lost">Perdido</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 font-medium">{stage.name}</span>
                            {getStageTypeBadge(stage.stage_type)}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => startEditing(stage)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(stage.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
};
