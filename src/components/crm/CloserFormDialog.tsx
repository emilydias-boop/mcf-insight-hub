import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Info, ExternalLink, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Closer, CloserFormData, useCreateCloser, useUpdateCloser } from '@/hooks/useClosers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CloserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closer?: Closer | null;
}

interface CalendlyEventType {
  uri: string;
  name: string;
  slug: string;
  duration_minutes: number;
  scheduling_url: string;
  active: boolean;
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
  const [eventTypes, setEventTypes] = useState<CalendlyEventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(false);

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

  const fetchEventTypes = async () => {
    setLoadingEventTypes(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendly-get-event-types');
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar Event Types');
      }
      
      setEventTypes(data.eventTypes || []);
      toast.success(`${data.eventTypes?.length || 0} Event Types encontrados`);
    } catch (error: any) {
      console.error('Error fetching event types:', error);
      toast.error(error.message || 'Erro ao buscar Event Types do Calendly');
    } finally {
      setLoadingEventTypes(false);
    }
  };

  const handleEventTypeSelect = (uri: string) => {
    const selectedEvent = eventTypes.find(et => et.uri === uri);
    if (selectedEvent) {
      setFormData({
        ...formData,
        calendly_event_type_uri: uri,
        calendly_default_link: selectedEvent.scheduling_url || formData.calendly_default_link
      });
    }
  };

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

  const hasValidEventTypeUri = formData.calendly_event_type_uri?.startsWith('https://api.calendly.com/event_types/');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
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

          {/* Calendly Event Type Section */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Configuração Calendly</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchEventTypes}
                disabled={loadingEventTypes}
              >
                {loadingEventTypes ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Buscar Event Types
              </Button>
            </div>

            {eventTypes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="event_type_select" className="text-xs text-muted-foreground">
                  Selecione o Event Type
                </Label>
                <Select
                  value={formData.calendly_event_type_uri || ''}
                  onValueChange={handleEventTypeSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um Event Type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((et) => (
                      <SelectItem key={et.uri} value={et.uri}>
                        {et.name} ({et.duration_minutes}min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          
            <div className="space-y-2">
              <Label htmlFor="calendly_link" className="text-xs">Link público do Calendly</Label>
              <Input
                id="calendly_link"
                value={formData.calendly_default_link}
                onChange={(e) => setFormData({ ...formData, calendly_default_link: e.target.value })}
                placeholder="https://calendly.com/usuario/reuniao"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendly_uri" className="text-xs">Event Type URI (API)</Label>
              <div className="flex gap-2">
                <Input
                  id="calendly_uri"
                  value={formData.calendly_event_type_uri}
                  onChange={(e) => setFormData({ ...formData, calendly_event_type_uri: e.target.value })}
                  placeholder="https://api.calendly.com/event_types/..."
                  className="text-sm flex-1"
                />
                {hasValidEventTypeUri && (
                  <CheckCircle2 className="h-5 w-5 text-green-500 self-center" />
                )}
              </div>
            </div>

            {!hasValidEventTypeUri && formData.calendly_default_link && (
              <Alert className="bg-amber-500/10 border-amber-500/30">
                <Info className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-xs">
                  Configure o Event Type URI para criar reuniões com link de videoconferência automático.
                  Clique em "Buscar Event Types" para selecionar.
                </AlertDescription>
              </Alert>
            )}

            {hasValidEventTypeUri && (
              <Alert className="bg-green-500/10 border-green-500/30">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-xs">
                  Calendly configurado! Reuniões criadas terão link de videoconferência automático.
                </AlertDescription>
              </Alert>
            )}
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
