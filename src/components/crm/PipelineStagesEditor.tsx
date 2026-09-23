import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  Plus,
  GripVertical,
  Trash2,
  Pencil,
  Check,
  X,
  MoreHorizontal,
  ChevronDown,
  Zap,
  Copy,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { useStageAdmin, StageOverviewRow } from '@/hooks/useStageAdmin';

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

const ColorSelect = ({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className={className}>
      <div className="w-4 h-4 rounded" style={{ backgroundColor: value }} />
    </SelectTrigger>
    <SelectContent>
      {stageColors.map((color) => (
        <SelectItem key={color.value} value={color.value}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: color.value }} />
            {color.label}
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

// ---------------------------------------------------------------------------
// Etapas de origem (pipeline) — fonte única: crm_stages
// ---------------------------------------------------------------------------

const motivoBloqueioExclusao = (stage: StageOverviewRow): string => {
  const motivos: string[] = [];
  const total = stage.deals_ativos + stage.deals_arquivados;
  if (total > 0) motivos.push(`tem ${total} negócios`);
  if (stage.automacoes > 0) motivos.push(`${stage.automacoes} automações`);
  if (stage.regras_replicacao > 0) motivos.push(`${stage.regras_replicacao} regras de replicação`);
  if (stage.webhooks > 0) motivos.push(`${stage.webhooks} webhooks`);
  if (stage.is_won_stage) motivos.push('é etapa de ganho');
  return motivos.length > 0
    ? `Não pode ser excluída: ${motivos.join(' / ')}. Use Desativar.`
    : 'Exclusão bloqueada pelo sistema. Use Desativar.';
};

const OriginStagesEditor = ({ originId }: { originId: string }) => {
  const {
    overview,
    podeAdministrar,
    createStage,
    updateStage,
    deactivateStage,
    reactivateStage,
    deleteStage,
    reorderStages,
  } = useStageAdmin(originId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', color: '#6b7280' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [newStage, setNewStage] = useState({ name: '', color: '#6b7280' });
  const [deactivating, setDeactivating] = useState<StageOverviewRow | null>(null);
  const [moveToStageId, setMoveToStageId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [deleting, setDeleting] = useState<StageOverviewRow | null>(null);
  const [showInativas, setShowInativas] = useState(false);

  const rows = overview.data || [];
  const ativas = useMemo(
    () => rows.filter((s) => s.is_active).sort((a, b) => a.stage_order - b.stage_order),
    [rows]
  );
  const inativas = useMemo(
    () => rows.filter((s) => !s.is_active).sort((a, b) => a.stage_order - b.stage_order),
    [rows]
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !podeAdministrar) return;
    const items = Array.from(ativas);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    reorderStages.mutate(items.map((s) => s.id));
  };

  const saveEdit = (stage: StageOverviewRow) => {
    if (!editForm.name.trim()) {
      toast.error('Nome da etapa é obrigatório');
      return;
    }
    updateStage.mutate(
      {
        id: stage.id,
        stage_name: editForm.name.trim(),
        color: editForm.color,
        temEspelhoLocal: stage.tem_espelho_local,
      },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const confirmarDesativacao = () => {
    if (!deactivating) return;
    if (deactivating.deals_ativos > 0 && !moveToStageId) {
      toast.error('Escolha a etapa de destino dos negócios');
      return;
    }
    deactivateStage.mutate(
      {
        stageId: deactivating.id,
        moveToStageId: deactivating.deals_ativos > 0 ? moveToStageId : undefined,
        motivo: motivo.trim() || undefined,
      },
      {
        onSuccess: () => {
          setDeactivating(null);
          setMoveToStageId('');
          setMotivo('');
        },
      }
    );
  };

  if (overview.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando etapas...</p>;
  }

  if (overview.isError) {
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar as etapas desta pipeline.
      </p>
    );
  }

  const renderRow = (stage: StageOverviewRow, index: number, dragProps?: {
    innerRef: (el: HTMLElement | null) => void;
    draggableProps: Record<string, unknown>;
    dragHandleProps: Record<string, unknown> | null;
    isDragging: boolean;
  }) => (
    <div
      ref={dragProps?.innerRef}
      {...(dragProps?.draggableProps || {})}
      className={cn(
        'flex items-center gap-3 p-3 border rounded-lg bg-background',
        dragProps?.isDragging && 'shadow-lg',
        !stage.is_active && 'opacity-60'
      )}
    >
      {dragProps ? (
        <div {...(dragProps.dragHandleProps || {})} className="cursor-grab">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
      ) : (
        <span className="text-xs text-muted-foreground w-5 text-center">{index + 1}</span>
      )}

      <div
        className="w-4 h-4 rounded flex-shrink-0"
        style={{ backgroundColor: stage.color || '#6b7280' }}
      />

      {editingId === stage.id ? (
        <>
          <Input
            value={editForm.name}
            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
            className="flex-1 h-8"
          />
          <ColorSelect
            value={editForm.color}
            onChange={(v) => setEditForm((p) => ({ ...p, color: v }))}
            className="w-24 h-8"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => saveEdit(stage)}
            disabled={updateStage.isPending}
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 font-medium">{stage.stage_name}</span>

          <Badge variant="secondary" className="text-xs">
            {stage.deals_ativos} cards
          </Badge>
          {stage.is_won_stage && <Badge className="bg-green-600 text-xs">Ganho</Badge>}
          {stage.automacoes > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Zap className="h-3.5 w-3.5 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>{stage.automacoes} automações</TooltipContent>
            </Tooltip>
          )}
          {stage.regras_replicacao > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Copy className="h-3.5 w-3.5 text-blue-500" />
              </TooltipTrigger>
              <TooltipContent>{stage.regras_replicacao} regras de replicação</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!podeAdministrar}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditingId(stage.id);
                  setEditForm({ name: stage.stage_name, color: stage.color || '#6b7280' });
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar nome/cor
              </DropdownMenuItem>

              {stage.is_active ? (
                stage.is_won_stage ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <DropdownMenuItem disabled>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Desativar
                        </DropdownMenuItem>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Etapa de ganho não pode ser desativada</TooltipContent>
                  </Tooltip>
                ) : (
                  <DropdownMenuItem
                    onClick={() => {
                      setDeactivating(stage);
                      setMoveToStageId('');
                      setMotivo('');
                    }}
                  >
                    <EyeOff className="h-4 w-4 mr-2" />
                    Desativar
                  </DropdownMenuItem>
                )
              ) : (
                <DropdownMenuItem onClick={() => reactivateStage.mutate(stage.id)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reativar
                </DropdownMenuItem>
              )}

              {stage.pode_excluir ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleting(stage)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir permanentemente
                </DropdownMenuItem>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem disabled>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir permanentemente
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{motivoBloqueioExclusao(stage)}</TooltipContent>
                </Tooltip>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Etapas do Kanban</h3>
            <p className="text-sm text-muted-foreground">
              Arraste para reordenar. As etapas são as mesmas usadas pelo restante do sistema.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowNewForm(true)}
            disabled={showNewForm || !podeAdministrar}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova Etapa
          </Button>
        </div>

        {showNewForm && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input
                  value={newStage.name}
                  onChange={(e) => setNewStage((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome da etapa"
                />
              </div>
              <div className="space-y-1">
                <Label>Cor</Label>
                <ColorSelect
                  value={newStage.color}
                  onChange={(v) => setNewStage((p) => ({ ...p, color: v }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={createStage.isPending}
                onClick={() => {
                  if (!newStage.name.trim()) {
                    toast.error('Nome da etapa é obrigatório');
                    return;
                  }
                  const nextOrder =
                    rows.length > 0 ? Math.max(...rows.map((s) => s.stage_order ?? 0)) + 1 : 0;
                  createStage.mutate(
                    { stage_name: newStage.name.trim(), color: newStage.color, nextOrder },
                    {
                      onSuccess: () => {
                        setShowNewForm(false);
                        setNewStage({ name: '', color: '#6b7280' });
                      },
                    }
                  );
                }}
              >
                {createStage.isPending ? 'Salvando...' : 'Criar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNewForm(false);
                  setNewStage({ name: '', color: '#6b7280' });
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {ativas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <p>Nenhuma etapa ativa nesta pipeline.</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="stages">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {ativas.map((stage, index) => (
                    <Draggable
                      key={stage.id}
                      draggableId={stage.id}
                      index={index}
                      isDragDisabled={!podeAdministrar || editingId === stage.id}
                    >
                      {(dp, snapshot) =>
                        renderRow(stage, index, {
                          innerRef: dp.innerRef,
                          draggableProps: dp.draggableProps,
                          dragHandleProps: dp.dragHandleProps,
                          isDragging: snapshot.isDragging,
                        })
                      }
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {inativas.length > 0 && (
          <Collapsible open={showInativas} onOpenChange={setShowInativas}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <ChevronDown
                  className={cn('h-4 w-4 mr-1 transition-transform', showInativas && 'rotate-180')}
                />
                Etapas desativadas ({inativas.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {inativas.map((stage, index) => renderRow(stage, index))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Diálogo de desativação */}
        <Dialog
          open={!!deactivating}
          onOpenChange={(open) => {
            if (!open) setDeactivating(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Desativar etapa</DialogTitle>
              <DialogDescription>
                {deactivating?.deals_ativos
                  ? `A etapa "${deactivating.stage_name}" tem ${deactivating.deals_ativos} negócios ativos. Escolha para onde eles vão.`
                  : `A etapa "${deactivating?.stage_name}" sai do kanban, mas o histórico é preservado.`}
              </DialogDescription>
            </DialogHeader>

            {!!deactivating?.deals_ativos && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Mover os {deactivating.deals_ativos} negócios para…</Label>
                  <Select value={moveToStageId} onValueChange={setMoveToStageId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a etapa de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {ativas
                        .filter((s) => s.id !== deactivating.id)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.stage_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Motivo (opcional)</Label>
                  <Textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Por que esta etapa está sendo desativada?"
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeactivating(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmarDesativacao} disabled={deactivateStage.isPending}>
                {deactivateStage.isPending ? 'Desativando...' : 'Desativar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmação de exclusão permanente */}
        <AlertDialog
          open={!!deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir "{deleting?.stage_name}" permanentemente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleting) {
                    deleteStage.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
                  }
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};

// ---------------------------------------------------------------------------
// Grupos: mantém a listagem local existente (grupos não têm origin única)
// ---------------------------------------------------------------------------

const GroupStagesEditor = ({ targetId }: { targetId: string }) => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; color: string; stage_type: StageType }>({
    name: '',
    color: '',
    stage_type: 'normal',
  });
  const [newStage, setNewStage] = useState<{ name: string; color: string; stage_type: StageType }>({
    name: '',
    color: '#6b7280',
    stage_type: 'normal',
  });
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['local-pipeline-stages', 'group', targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('local_pipeline_stages')
        .select('*')
        .eq('group_id', targetId)
        .order('stage_order');
      if (error) throw error;
      return data as LocalStage[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (stage: Omit<LocalStage, 'id' | 'stage_order'>) => {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map((s) => s.stage_order)) : -1;
      const { data: createdStage, error } = await supabase
        .from('local_pipeline_stages')
        .insert({
          group_id: targetId,
          name: stage.name,
          color: stage.color,
          stage_type: stage.stage_type,
          stage_order: maxOrder + 1,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (createdStage) {
        const { error: mirrorError } = await supabase.functions.invoke('ensure-crm-stage-mirror', {
          body: { stage_id: createdStage.id },
        });
        if (mirrorError) {
          await supabase.from('local_pipeline_stages').delete().eq('id', createdStage.id);
          throw new Error(`Erro ao sincronizar etapa: ${mirrorError.message}`);
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
    onError: (error) => toast.error('Erro ao criar etapa: ' + (error as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LocalStage> & { id: string }) => {
      const { error } = await supabase.from('local_pipeline_stages').update(updates).eq('id', id);
      if (error) throw error;

      const crmUpdates: Record<string, unknown> = {};
      if (updates.name) crmUpdates.stage_name = updates.name;
      if (updates.color) crmUpdates.color = updates.color;
      if (Object.keys(crmUpdates).length > 0) {
        const { error: mirrorError } = await supabase
          .from('crm_stages')
          .update(crmUpdates)
          .eq('id', id);
        if (mirrorError) {
          console.warn('[PipelineStagesEditor] Falha ao espelhar update:', mirrorError.message);
        }
      }
    },
    onSuccess: () => {
      toast.success('Etapa atualizada!');
      queryClient.invalidateQueries({ queryKey: ['local-pipeline-stages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      setEditingId(null);
    },
    onError: (error) => toast.error('Erro ao atualizar: ' + (error as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('local_pipeline_stages').delete().eq('id', id);
      if (error) throw error;
      const { error: mirrorError } = await supabase
        .from('crm_stages')
        .update({ is_active: false })
        .eq('id', id);
      if (mirrorError) {
        console.warn('[PipelineStagesEditor] Falha ao desativar espelho:', mirrorError.message);
      }
    },
    onSuccess: () => {
      toast.success('Etapa removida!');
      queryClient.invalidateQueries({ queryKey: ['local-pipeline-stages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
    },
    onError: (error) => toast.error('Erro ao remover: ' + (error as Error).message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (let index = 0; index < orderedIds.length; index++) {
        const id = orderedIds[index];
        const { error } = await supabase
          .from('local_pipeline_stages')
          .update({ stage_order: index })
          .eq('id', id);
        if (error) throw error;
        const { error: mirrorError } = await supabase
          .from('crm_stages')
          .update({ stage_order: index })
          .eq('id', id);
        if (mirrorError) {
          console.warn('[PipelineStagesEditor] Falha ao espelhar ordem:', mirrorError.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-pipeline-stages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
    },
    onError: (error) => toast.error('Erro ao reordenar: ' + (error as Error).message),
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(stages);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    reorderMutation.mutate(items.map((s) => s.id));
  };

  const getStageTypeBadge = (type: string) => {
    if (type === 'won') return <Badge className="bg-green-600">Ganho</Badge>;
    if (type === 'lost') return <Badge variant="destructive">Perdido</Badge>;
    return null;
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando etapas...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Etapas do Kanban</h3>
          <p className="text-sm text-muted-foreground">Arraste para reordenar. Clique para editar.</p>
        </div>
        <Button size="sm" onClick={() => setShowNewForm(true)} disabled={showNewForm}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Etapa
        </Button>
      </div>

      {showNewForm && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={newStage.name}
                onChange={(e) => setNewStage((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome da etapa"
              />
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <ColorSelect
                value={newStage.color}
                onChange={(v) => setNewStage((p) => ({ ...p, color: v }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={newStage.stage_type}
                onValueChange={(v) => setNewStage((p) => ({ ...p, stage_type: v as StageType }))}
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
            <Button
              size="sm"
              disabled={createMutation.isPending}
              onClick={() => {
                if (!newStage.name.trim()) {
                  toast.error('Nome da etapa é obrigatório');
                  return;
                }
                createMutation.mutate(newStage);
              }}
            >
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
                    {(dp, snapshot) => (
                      <div
                        ref={dp.innerRef}
                        {...dp.draggableProps}
                        className={cn(
                          'flex items-center gap-3 p-3 border rounded-lg bg-background',
                          snapshot.isDragging && 'shadow-lg'
                        )}
                      >
                        <div {...dp.dragHandleProps} className="cursor-grab">
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
                              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                              className="flex-1 h-8"
                            />
                            <ColorSelect
                              value={editForm.color}
                              onChange={(v) => setEditForm((p) => ({ ...p, color: v }))}
                              className="w-24 h-8"
                            />
                            <Select
                              value={editForm.stage_type}
                              onValueChange={(v) =>
                                setEditForm((p) => ({ ...p, stage_type: v as StageType }))
                              }
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
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() =>
                                editingId && updateMutation.mutate({ id: editingId, ...editForm })
                              }
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingId(null)}
                            >
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
                              onClick={() => {
                                setEditingId(stage.id);
                                setEditForm({
                                  name: stage.name,
                                  color: stage.color,
                                  stage_type: stage.stage_type,
                                });
                              }}
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

export const PipelineStagesEditor = ({ targetType, targetId }: PipelineStagesEditorProps) => {
  if (targetType === 'origin') {
    return <OriginStagesEditor originId={targetId} />;
  }
  return <GroupStagesEditor targetId={targetId} />;
};
