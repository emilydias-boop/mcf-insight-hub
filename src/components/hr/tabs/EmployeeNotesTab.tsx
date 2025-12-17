import { useState } from 'react';
import { Employee, EmployeeNote, NOTE_TYPE_LABELS } from '@/types/hr';
import { useEmployeeNotes, useEmployeeMutations } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StickyNote, Plus, Lock, X, Pencil, Trash2, Check } from 'lucide-react';

interface EmployeeNotesTabProps {
  employee: Employee;
}

export default function EmployeeNotesTab({ employee }: EmployeeNotesTabProps) {
  const { data: notes, isLoading, refetch } = useEmployeeNotes(employee.id);
  const { createNote, updateNote, deleteNote } = useEmployeeMutations();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<EmployeeNote | null>(null);
  
  const [newNote, setNewNote] = useState({
    titulo: '',
    conteudo: '',
    tipo: 'geral' as EmployeeNote['tipo'],
    privada: false,
  });

  const [editData, setEditData] = useState({
    titulo: '',
    conteudo: '',
    tipo: 'geral' as EmployeeNote['tipo'],
    privada: false,
  });

  const handleSubmit = () => {
    if (!newNote.conteudo.trim()) return;

    createNote.mutate(
      {
        employee_id: employee.id,
        ...newNote,
      },
      {
        onSuccess: () => {
          setNewNote({ titulo: '', conteudo: '', tipo: 'geral', privada: false });
          setShowForm(false);
          refetch();
        },
      }
    );
  };

  const startEditing = (note: EmployeeNote) => {
    setEditingId(note.id);
    setEditData({
      titulo: note.titulo || '',
      conteudo: note.conteudo,
      tipo: note.tipo,
      privada: note.privada,
    });
  };

  const handleUpdate = (noteId: string) => {
    if (!editData.conteudo.trim()) return;

    updateNote.mutate(
      { id: noteId, data: editData },
      {
        onSuccess: () => {
          setEditingId(null);
          refetch();
        },
      }
    );
  };

  const handleDelete = () => {
    if (!selectedNote) return;
    deleteNote.mutate(selectedNote.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setSelectedNote(null);
        refetch();
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!showForm ? (
        <div className="flex justify-end">
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Nota
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Nova Nota</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Título (opcional)"
              value={newNote.titulo}
              onChange={(e) => setNewNote({ ...newNote, titulo: e.target.value })}
            />
            <Textarea
              placeholder="Escreva a nota..."
              value={newNote.conteudo}
              onChange={(e) => setNewNote({ ...newNote, conteudo: e.target.value })}
              rows={4}
            />
            <div className="flex items-center gap-3">
              <Select
                value={newNote.tipo}
                onValueChange={(v) => setNewNote({ ...newNote, tipo: v as EmployeeNote['tipo'] })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NOTE_TYPE_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newNote.privada}
                  onChange={(e) => setNewNote({ ...newNote, privada: e.target.checked })}
                  className="rounded"
                />
                <Lock className="h-3 w-3" />
                Nota privada
              </label>
              <div className="flex-1" />
              <Button onClick={handleSubmit} disabled={!newNote.conteudo.trim() || createNote.isPending}>
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {notes && notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                {editingId === note.id ? (
                  <div className="space-y-3">
                    <Input
                      placeholder="Título (opcional)"
                      value={editData.titulo}
                      onChange={(e) => setEditData({ ...editData, titulo: e.target.value })}
                    />
                    <Textarea
                      value={editData.conteudo}
                      onChange={(e) => setEditData({ ...editData, conteudo: e.target.value })}
                      rows={4}
                    />
                    <div className="flex items-center gap-3">
                      <Select
                        value={editData.tipo}
                        onValueChange={(v) => setEditData({ ...editData, tipo: v as EmployeeNote['tipo'] })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(NOTE_TYPE_LABELS).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editData.privada}
                          onChange={(e) => setEditData({ ...editData, privada: e.target.checked })}
                          className="rounded"
                        />
                        <Lock className="h-3 w-3" />
                        Privada
                      </label>
                      <div className="flex-1" />
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleUpdate(note.id)} disabled={updateNote.isPending}>
                        <Check className="h-4 w-4 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {note.titulo && <p className="font-medium">{note.titulo}</p>}
                        <Badge className={NOTE_TYPE_LABELS[note.tipo].color}>
                          {NOTE_TYPE_LABELS[note.tipo].label}
                        </Badge>
                        {note.privada && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(note)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive" 
                          onClick={() => { setSelectedNote(note); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{note.conteudo}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        !showForm && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma nota registrada</p>
              <p className="text-xs mt-1">Adicione feedbacks, observações e anotações</p>
            </CardContent>
          </Card>
        )
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A nota será removida permanentemente.
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
