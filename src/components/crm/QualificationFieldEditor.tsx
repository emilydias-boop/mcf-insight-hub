import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { QualificationField } from '@/components/crm/qualification/QualificationFields';
import { GripVertical, Pencil, Trash2, Plus, X } from 'lucide-react';

interface QualificationFieldEditorProps {
  fields: QualificationField[];
  onChange: (fields: QualificationField[]) => void;
}

export function QualificationFieldEditor({ fields, onChange }: QualificationFieldEditorProps) {
  const [editingField, setEditingField] = useState<QualificationField | null>(null);
  const [editIndex, setEditIndex] = useState<number>(-1);
  const [newOption, setNewOption] = useState('');

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onChange(items);
  };

  const handleAddField = () => {
    const newField: QualificationField = {
      key: `campo_${Date.now()}`,
      label: 'Novo Campo',
      type: 'text',
      required: false,
    };
    setEditingField(newField);
    setEditIndex(-1);
  };

  const handleEditField = (field: QualificationField, index: number) => {
    setEditingField({ ...field });
    setEditIndex(index);
  };

  const handleDeleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    onChange(newFields);
  };

  const handleSaveField = () => {
    if (!editingField) return;

    const fieldToSave = {
      ...editingField,
      key: editingField.key || editingField.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
    };

    if (editIndex >= 0) {
      const newFields = [...fields];
      newFields[editIndex] = fieldToSave;
      onChange(newFields);
    } else {
      onChange([...fields, fieldToSave]);
    }

    setEditingField(null);
    setEditIndex(-1);
  };

  const handleAddOption = () => {
    if (!editingField || !newOption.trim()) return;
    
    const options = editingField.options || [];
    setEditingField({
      ...editingField,
      options: [...options, newOption.trim()],
    });
    setNewOption('');
  };

  const handleRemoveOption = (optionIndex: number) => {
    if (!editingField?.options) return;
    
    const newOptions = editingField.options.filter((_, i) => i !== optionIndex);
    setEditingField({
      ...editingField,
      options: newOptions,
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'select': return 'Seleção';
      case 'text': return 'Texto';
      case 'boolean': return 'Sim/Não';
      default: return type;
    }
  };

  const otherFields = fields.filter(f => f.key !== editingField?.key);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Campos de Qualificação</Label>
        <Button variant="outline" size="sm" onClick={handleAddField}>
          <Plus className="h-4 w-4 mr-1" />
          Campo
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="fields">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {fields.map((field, index) => (
                <Draggable key={field.key} draggableId={field.key} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex items-center gap-2 p-3 border rounded-lg bg-card ${
                        snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                      }`}
                    >
                      <div {...provided.dragHandleProps} className="cursor-grab">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {field.icon && <span className="text-sm">{field.icon}</span>}
                          <span className="font-medium text-sm truncate">{field.label}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {getTypeLabel(field.type)}
                          </Badge>
                          {field.required && (
                            <Badge variant="default" className="text-xs">
                              Obrigatório
                            </Badge>
                          )}
                          {field.showIf && (
                            <Badge variant="outline" className="text-xs">
                              Condicional
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditField(field, index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteField(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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

      {fields.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <p>Nenhum campo configurado.</p>
          <p className="text-sm">Clique em "+ Campo" para adicionar.</p>
        </div>
      )}

      {/* Edit Field Dialog */}
      <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editIndex >= 0 ? 'Editar Campo' : 'Novo Campo'}
            </DialogTitle>
          </DialogHeader>

          {editingField && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Campo</Label>
                <Input
                  value={editingField.label}
                  onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
                  placeholder="Ex: Profissão"
                />
              </div>

              <div className="space-y-2">
                <Label>Ícone (emoji)</Label>
                <Input
                  value={editingField.icon || ''}
                  onChange={(e) => setEditingField({ ...editingField, icon: e.target.value })}
                  placeholder="Ex: 👤"
                  maxLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={editingField.type}
                  onValueChange={(value) => setEditingField({ 
                    ...editingField, 
                    type: value as 'select' | 'text' | 'boolean',
                    options: value === 'select' ? (editingField.options || []) : undefined,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="select">Seleção</SelectItem>
                    <SelectItem value="boolean">Sim/Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingField.type === 'select' && (
                <div className="space-y-2">
                  <Label>Opções</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Nova opção"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={handleAddOption}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {(editingField.options || []).map((option, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <span className="flex-1 text-sm">{option}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemoveOption(i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label>Campo obrigatório</Label>
                <Switch
                  checked={editingField.required || false}
                  onCheckedChange={(checked) => setEditingField({ ...editingField, required: checked })}
                />
              </div>

              {otherFields.length > 0 && editingField.type !== 'boolean' && (
                <div className="space-y-2">
                  <Label>Mostrar apenas se (condicional)</Label>
                  <Select
                    value={editingField.showIf || 'none'}
                    onValueChange={(value) => setEditingField({ 
                      ...editingField, 
                      showIf: value === 'none' ? undefined : value 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sempre visível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sempre visível</SelectItem>
                      {otherFields
                        .filter(f => f.type === 'boolean')
                        .map(f => (
                          <SelectItem key={f.key} value={f.key}>
                            Se "{f.label}" = Sim
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveField}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
