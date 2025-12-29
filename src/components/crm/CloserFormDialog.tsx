import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info, ExternalLink } from 'lucide-react';
import { Closer, CloserFormData, useCreateCloser, useUpdateCloser } from '@/hooks/useClosers';

interface CloserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closer?: Closer | null;
}

const COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#f59e0b', label: 'Laranja' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#84cc16', label: 'Lima' },
];

export function CloserFormDialog({ open, onOpenChange, closer }: CloserFormDialogProps) {
  const [formData, setFormData] = useState<CloserFormData>({
    name: '',
    email: '',
    color: '#3b82f6',
    is_active: true,
    calendly_event_type_uri: '',
    calendly_default_link: ''
  });

  const createCloser = useCreateCloser();
  const updateCloser = useUpdateCloser();
  const isLoading = createCloser.isPending || updateCloser.isPending;
  const isEditing = !!closer;

  useEffect(() => {
    if (closer) {
      setFormData({
        name: closer.name,
        email: closer.email,
        color: closer.color || '#3b82f6',
        is_active: closer.is_active ?? true,
        calendly_event_type_uri: closer.calendly_event_type_uri || '',
        calendly_default_link: closer.calendly_default_link || ''
      });
    } else {
      setFormData({
        name: '',
        email: '',
        color: '#3b82f6',
        is_active: true,
        calendly_event_type_uri: '',
        calendly_default_link: ''
      });
    }
  }, [closer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isEditing && closer) {
        await updateCloser.mutateAsync({ id: closer.id, data: formData });
      } else {
        await createCloser.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Closer' : 'Adicionar Closer'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome do closer"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Cor de Identificação</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    formData.color === color.value 
                      ? 'border-foreground scale-110' 
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="calendly_link">Link do Calendly (para enviar aos leads)</Label>
            <Input
              id="calendly_link"
              value={formData.calendly_default_link}
              onChange={(e) => setFormData({ ...formData, calendly_default_link: e.target.value })}
              placeholder="https://calendly.com/julio-mcf/reuniao-r01"
            />
            <p className="text-xs text-muted-foreground">
              Link público do Calendly que será enviado aos leads ao agendar reuniões
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calendly_uri">Calendly Event Type URI (opcional)</Label>
            <Input
              id="calendly_uri"
              value={formData.calendly_event_type_uri}
              onChange={(e) => setFormData({ ...formData, calendly_event_type_uri: e.target.value })}
              placeholder="https://api.calendly.com/event_types/..."
            />
            <p className="text-xs text-muted-foreground">
              URI da API para integrações avançadas (opcional)
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Closer Ativo</Label>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
