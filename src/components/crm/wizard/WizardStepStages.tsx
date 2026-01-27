import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus, Trash2, RotateCcw } from 'lucide-react';
import { WizardData, WizardStage, DEFAULT_STAGES } from './types';
import { cn } from '@/lib/utils';

interface WizardStepStagesProps {
  data: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  errors: Record<string, string>;
}

const STAGE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#22c55e', // green
  '#ef4444', // red
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f97316', // orange
];

export const WizardStepStages = ({ data, onChange, errors }: WizardStepStagesProps) => {
  const [newStageName, setNewStageName] = useState('');

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(data.stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order
    const updatedStages = items.map((stage, index) => ({
      ...stage,
      stage_order: index,
    }));

    onChange({ stages: updatedStages });
  };

  const addStage = () => {
    if (!newStageName.trim()) return;

    const newStage: WizardStage = {
      id: crypto.randomUUID(),
      name: newStageName.trim(),
      color: STAGE_COLORS[data.stages.length % STAGE_COLORS.length],
      stage_type: 'normal',
      stage_order: data.stages.length,
    };

    onChange({ stages: [...data.stages, newStage] });
    setNewStageName('');
  };

  const updateStage = (id: string, updates: Partial<WizardStage>) => {
    const updatedStages = data.stages.map((stage) =>
      stage.id === id ? { ...stage, ...updates } : stage
    );
    onChange({ stages: updatedStages });
  };

  const removeStage = (id: string) => {
    const updatedStages = data.stages
      .filter((stage) => stage.id !== id)
      .map((stage, index) => ({ ...stage, stage_order: index }));
    onChange({ stages: updatedStages });
  };

  const resetToDefaults = () => {
    onChange({ stages: DEFAULT_STAGES.map((s, i) => ({ ...s, id: crypto.randomUUID(), stage_order: i })) });
  };

  const getStageTypeBadge = (type: string) => {
    switch (type) {
      case 'won':
        return <Badge variant="default" className="bg-green-500 text-white text-xs">Ganho</Badge>;
      case 'lost':
        return <Badge variant="default" className="bg-red-500 text-white text-xs">Perdido</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Normal</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Etapas do Kanban</h3>
          <p className="text-sm text-muted-foreground">
            Configure as etapas do funil. Arraste para reordenar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetToDefaults}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Restaurar Padrões
        </Button>
      </div>

      {errors.stages && (
        <p className="text-sm text-destructive">{errors.stages}</p>
      )}

      {/* Stage List */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="stages">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {data.stages.map((stage, index) => (
                <Draggable key={stage.id} draggableId={stage.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border bg-background transition-shadow",
                        snapshot.isDragging && "shadow-lg"
                      )}
                    >
                      <div {...provided.dragHandleProps} className="cursor-grab">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                      </div>

                      {/* Color */}
                      <input
                        type="color"
                        value={stage.color}
                        onChange={(e) => updateStage(stage.id, { color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />

                      {/* Name */}
                      <Input
                        value={stage.name}
                        onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                        className="flex-1"
                        placeholder="Nome da etapa"
                      />

                      {/* Type */}
                      <Select
                        value={stage.stage_type}
                        onValueChange={(value: 'normal' | 'won' | 'lost') =>
                          updateStage(stage.id, { stage_type: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="won">Ganho ✅</SelectItem>
                          <SelectItem value="lost">Perdido ❌</SelectItem>
                        </SelectContent>
                      </Select>

                      {getStageTypeBadge(stage.stage_type)}

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStage(stage.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Stage */}
      <div className="flex gap-2">
        <Input
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          placeholder="Nome da nova etapa"
          onKeyDown={(e) => e.key === 'Enter' && addStage()}
        />
        <Button onClick={addStage} disabled={!newStageName.trim()}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm text-muted-foreground border-t pt-4">
        <span>{data.stages.length} etapas</span>
        <span>•</span>
        <span>{data.stages.filter(s => s.stage_type === 'won').length} de ganho</span>
        <span>•</span>
        <span>{data.stages.filter(s => s.stage_type === 'lost').length} de perda</span>
      </div>
    </div>
  );
};
