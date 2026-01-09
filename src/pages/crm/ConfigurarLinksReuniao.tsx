import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Link2, Plus, Trash2, Pencil, Video, ArrowLeft, Clock } from 'lucide-react';
import { useClosersList } from '@/hooks/useClosers';
import { 
  useCloserMeetingLinksList, 
  useCreateCloserMeetingLink, 
  useUpdateCloserMeetingLink, 
  useDeleteCloserMeetingLink 
} from '@/hooks/useCloserMeetingLinks';
import { Link } from 'react-router-dom';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

interface LinkFormData {
  start_time: string;
  google_meet_link: string;
}

const ConfigurarLinksReuniao = () => {
  const { data: closers = [], isLoading: loadingClosers } = useClosersList();
  const activeClosers = closers.filter(c => c.is_active);
  
  const [selectedCloserId, setSelectedCloserId] = useState<string>('');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<{ id: string; google_meet_link: string } | null>(null);
  const [formData, setFormData] = useState<LinkFormData>({ start_time: '09:00', google_meet_link: '' });

  // Set default closer when data loads
  if (!selectedCloserId && activeClosers.length > 0) {
    setSelectedCloserId(activeClosers[0].id);
  }

  const { data: links = [], isLoading: loadingLinks } = useCloserMeetingLinksList(
    selectedCloserId,
    selectedDayOfWeek
  );

  const createMutation = useCreateCloserMeetingLink();
  const updateMutation = useUpdateCloserMeetingLink();
  const deleteMutation = useDeleteCloserMeetingLink();

  const handleAddLink = () => {
    if (!selectedCloserId || !formData.start_time || !formData.google_meet_link) return;

    createMutation.mutate({
      closer_id: selectedCloserId,
      day_of_week: selectedDayOfWeek,
      start_time: formData.start_time + ':00',
      google_meet_link: formData.google_meet_link,
    }, {
      onSuccess: () => {
        setIsAddModalOpen(false);
        setFormData({ start_time: '09:00', google_meet_link: '' });
      }
    });
  };

  const handleUpdateLink = () => {
    if (!editingLink) return;

    updateMutation.mutate({
      id: editingLink.id,
      google_meet_link: editingLink.google_meet_link,
    }, {
      onSuccess: () => {
        setIsEditModalOpen(false);
        setEditingLink(null);
      }
    });
  };

  const handleDeleteLink = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => setDeleteId(null)
    });
  };

  const formatTime = (time: string) => {
    return time.slice(0, 5);
  };

  if (loadingClosers) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/crm/agenda">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configurar Links de Reunião</h2>
          <p className="text-muted-foreground">
            Gerencie os links de Google Meet para cada closer por dia e horário
          </p>
        </div>
      </div>

      {/* Closer Tabs */}
      <Tabs value={selectedCloserId} onValueChange={setSelectedCloserId}>
        <TabsList className="bg-muted">
          {activeClosers.map(closer => (
            <TabsTrigger key={closer.id} value={closer.id} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: closer.color || '#6366f1' }} 
              />
              {closer.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {activeClosers.map(closer => (
          <TabsContent key={closer.id} value={closer.id}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5 text-primary" />
                      Links de {closer.name}
                    </CardTitle>
                    <CardDescription>
                      Configure os links de Google Meet para cada horário de atendimento
                    </CardDescription>
                  </div>
                  <Select 
                    value={selectedDayOfWeek.toString()} 
                    onValueChange={(v) => setSelectedDayOfWeek(parseInt(v))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map(day => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loadingLinks ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : links.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum link configurado para este dia</p>
                    <p className="text-sm">Clique em "Adicionar Horário" para configurar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {links.map(link => (
                      <div 
                        key={link.id} 
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 font-mono text-lg font-semibold text-primary">
                            {formatTime(link.start_time)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Link2 className="h-4 w-4" />
                            <span className="truncate max-w-md">{link.google_meet_link}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingLink({ id: link.id, google_meet_link: link.google_meet_link });
                              setIsEditModalOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(link.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  className="mt-4 w-full" 
                  variant="outline"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Horário
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Add Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Horário</DialogTitle>
            <DialogDescription>
              Configure um novo horário com link de Google Meet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link">Link do Google Meet</Label>
              <Input
                id="link"
                type="url"
                placeholder="https://meet.google.com/..."
                value={formData.google_meet_link}
                onChange={(e) => setFormData(prev => ({ ...prev, google_meet_link: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddLink} 
              disabled={createMutation.isPending || !formData.google_meet_link}
            >
              {createMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Link</DialogTitle>
            <DialogDescription>
              Altere o link do Google Meet para este horário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-link">Link do Google Meet</Label>
              <Input
                id="edit-link"
                type="url"
                placeholder="https://meet.google.com/..."
                value={editingLink?.google_meet_link || ''}
                onChange={(e) => setEditingLink(prev => prev ? { ...prev, google_meet_link: e.target.value } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateLink} 
              disabled={updateMutation.isPending || !editingLink?.google_meet_link}
            >
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este horário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteLink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ConfigurarLinksReuniao;
