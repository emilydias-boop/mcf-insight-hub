import { useState } from 'react';
import { Employee, EmployeeEvent } from '@/types/hr';
import { useEmployeeEvents, useEmployeeMutations } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  History, 
  Plus, 
  TrendingUp, 
  Award, 
  AlertTriangle, 
  Calendar,
  ArrowRight,
  Briefcase,
  Pencil,
  Trash2
} from 'lucide-react';

interface EmployeeHistoryTabProps {
  employee: Employee;
}

const EVENT_TYPES = [
  { value: 'promocao', label: 'Promoção' },
  { value: 'aumento', label: 'Aumento Salarial' },
  { value: 'advertencia', label: 'Advertência' },
  { value: 'ferias', label: 'Férias' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'mudanca_cargo', label: 'Mudança de Cargo' },
  { value: 'outro', label: 'Outro' },
];

const EVENT_ICONS: Record<string, React.ReactNode> = {
  promocao: <TrendingUp className="h-4 w-4 text-green-500" />,
  aumento: <Award className="h-4 w-4 text-blue-500" />,
  advertencia: <AlertTriangle className="h-4 w-4 text-red-500" />,
  ferias: <Calendar className="h-4 w-4 text-cyan-500" />,
  transferencia: <ArrowRight className="h-4 w-4 text-purple-500" />,
  mudanca_cargo: <Briefcase className="h-4 w-4 text-orange-500" />,
};

export default function EmployeeHistoryTab({ employee }: EmployeeHistoryTabProps) {
  const { data: events, isLoading, refetch } = useEmployeeEvents(employee.id);
  const { createEvent, updateEvent, deleteEvent } = useEmployeeMutations();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EmployeeEvent | null>(null);
  
  const [formData, setFormData] = useState({
    tipo_evento: '',
    titulo: '',
    descricao: '',
    data_evento: format(new Date(), 'yyyy-MM-dd'),
    valor_anterior: '',
    valor_novo: '',
  });

  const resetForm = () => {
    setFormData({
      tipo_evento: '',
      titulo: '',
      descricao: '',
      data_evento: format(new Date(), 'yyyy-MM-dd'),
      valor_anterior: '',
      valor_novo: '',
    });
    setSelectedEvent(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (event: EmployeeEvent) => {
    setSelectedEvent(event);
    setFormData({
      tipo_evento: event.tipo_evento,
      titulo: event.titulo,
      descricao: event.descricao || '',
      data_evento: event.data_evento,
      valor_anterior: event.valor_anterior || '',
      valor_novo: event.valor_novo || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.tipo_evento || !formData.titulo) return;

    const eventData = {
      ...formData,
      valor_anterior: formData.valor_anterior || null,
      valor_novo: formData.valor_novo || null,
    };

    if (selectedEvent) {
      await updateEvent.mutateAsync({ id: selectedEvent.id, data: eventData });
    } else {
      await createEvent.mutateAsync({ ...eventData, employee_id: employee.id });
    }

    setDialogOpen(false);
    resetForm();
    refetch();
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    await deleteEvent.mutateAsync(selectedEvent.id);
    setDeleteDialogOpen(false);
    setSelectedEvent(null);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Registrar Evento
        </Button>
      </div>

      {events && events.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-0 w-8 h-8 rounded-full bg-background border-2 flex items-center justify-center">
                  {EVENT_ICONS[event.tipo_evento] || <History className="h-4 w-4 text-muted-foreground" />}
                </div>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{event.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(event.data_evento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-muted px-2 py-1 rounded capitalize">
                          {event.tipo_evento.replace('_', ' ')}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(event)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive" 
                          onClick={() => { setSelectedEvent(event); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {event.descricao && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {event.descricao}
                      </p>
                    )}

                    {(event.valor_anterior || event.valor_novo) && (
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        {event.valor_anterior && (
                          <span className="line-through text-muted-foreground">
                            {event.valor_anterior}
                          </span>
                        )}
                        {event.valor_anterior && event.valor_novo && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        {event.valor_novo && (
                          <span className="font-medium text-green-600">
                            {event.valor_novo}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum evento registrado</p>
            <p className="text-xs mt-1">Registre promoções, mudanças de cargo, etc.</p>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent ? 'Editar Evento' : 'Registrar Evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Evento *</Label>
              <Select value={formData.tipo_evento} onValueChange={(v) => setFormData({ ...formData, tipo_evento: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Promoção para Coordenador"
              />
            </div>
            <div className="space-y-2">
              <Label>Data do Evento</Label>
              <Input
                type="date"
                value={formData.data_evento}
                onChange={(e) => setFormData({ ...formData, data_evento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Anterior</Label>
                <Input
                  value={formData.valor_anterior}
                  onChange={(e) => setFormData({ ...formData, valor_anterior: e.target.value })}
                  placeholder="Ex: R$ 3.000"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Novo</Label>
                <Input
                  value={formData.valor_novo}
                  onChange={(e) => setFormData({ ...formData, valor_novo: e.target.value })}
                  placeholder="Ex: R$ 3.500"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createEvent.isPending || updateEvent.isPending}>
              {selectedEvent ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento "{selectedEvent?.titulo}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
