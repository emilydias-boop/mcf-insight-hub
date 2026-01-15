import { useState } from 'react';
import { Plus, Trash2, Save, Palette } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  useR2StatusOptions, useCreateR2StatusOption, 
  useUpdateR2StatusOption, useDeleteR2StatusOption,
  useR2ThermometerOptions, useCreateR2ThermometerOption,
  useUpdateR2ThermometerOption, useDeleteR2ThermometerOption
} from '@/hooks/useR2StatusOptions';
import { R2StatusOption, R2ThermometerOption } from '@/types/r2Agenda';

interface R2StatusConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLOR_PRESETS = [
  '#22C55E', '#EF4444', '#F59E0B', '#3B82F6', 
  '#8B5CF6', '#EC4899', '#14B8A6', '#6B7280'
];

export function R2StatusConfigModal({ open, onOpenChange }: R2StatusConfigModalProps) {
  const { data: statusOptions = [] } = useR2StatusOptions();
  const { data: thermometerOptions = [] } = useR2ThermometerOptions();
  
  const createStatus = useCreateR2StatusOption();
  const updateStatus = useUpdateR2StatusOption();
  const deleteStatus = useDeleteR2StatusOption();
  
  const createThermometer = useCreateR2ThermometerOption();
  const updateThermometer = useUpdateR2ThermometerOption();
  const deleteThermometer = useDeleteR2ThermometerOption();

  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#3B82F6');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8B5CF6');

  const handleAddStatus = () => {
    if (!newStatusName.trim()) return;
    createStatus.mutate({
      name: newStatusName.trim(),
      color: newStatusColor,
      display_order: statusOptions.length
    });
    setNewStatusName('');
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    createThermometer.mutate({
      name: newTagName.trim(),
      color: newTagColor
    });
    setNewTagName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar Status e Tags R2</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="status" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="status">Status Finais</TabsTrigger>
            <TabsTrigger value="tags">Termômetros</TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-4 mt-4">
            <div className="space-y-2">
              {statusOptions.map((status, idx) => (
                <div key={status.id} className="flex items-center gap-2 p-2 border rounded-md">
                  <div 
                    className="h-4 w-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: status.color }}
                  />
                  <Input
                    value={status.name}
                    onChange={(e) => updateStatus.mutate({ id: status.id, name: e.target.value })}
                    className="flex-1 h-8"
                  />
                  <div className="flex gap-1">
                    {COLOR_PRESETS.map(color => (
                      <button
                        key={color}
                        className="h-5 w-5 rounded-full border border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => updateStatus.mutate({ id: status.id, color })}
                      />
                    ))}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteStatus.mutate(status.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator />

            {/* Add new status */}
            <div className="space-y-2">
              <Label className="text-sm">Adicionar novo status</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do status"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddStatus()}
                />
                <div className="flex gap-1">
                  {COLOR_PRESETS.slice(0, 4).map(color => (
                    <button
                      key={color}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        newStatusColor === color ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewStatusColor(color)}
                    />
                  ))}
                </div>
                <Button onClick={handleAddStatus} disabled={!newStatusName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tags/Thermometer Tab */}
          <TabsContent value="tags" className="space-y-4 mt-4">
            <div className="space-y-2">
              {thermometerOptions.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2 p-2 border rounded-md">
                  <div 
                    className="h-4 w-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <Input
                    value={tag.name}
                    onChange={(e) => updateThermometer.mutate({ id: tag.id, name: e.target.value })}
                    className="flex-1 h-8"
                  />
                  <div className="flex gap-1">
                    {COLOR_PRESETS.map(color => (
                      <button
                        key={color}
                        className="h-5 w-5 rounded-full border border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => updateThermometer.mutate({ id: tag.id, color })}
                      />
                    ))}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteThermometer.mutate(tag.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator />

            {/* Add new tag */}
            <div className="space-y-2">
              <Label className="text-sm">Adicionar nova tag</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <div className="flex gap-1">
                  {COLOR_PRESETS.slice(0, 4).map(color => (
                    <button
                      key={color}
                      className={`h-8 w-8 rounded-full border-2 transition-transform ${
                        newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTagColor(color)}
                    />
                  ))}
                </div>
                <Button onClick={handleAddTag} disabled={!newTagName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
