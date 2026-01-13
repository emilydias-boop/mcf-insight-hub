import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tag, ArrowRightLeft, MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  useAttendeeNotes, 
  useAddAttendeeNote, 
  useDeleteAttendeeNote,
  AttendeeNote,
  NoteType 
} from '@/hooks/useAttendeeNotes';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AttendeeNotesSectionProps {
  attendeeId: string | null | undefined;
  participantName: string;
  canAddNotes?: boolean;
}

const NOTE_TYPE_CONFIG: Record<NoteType, { icon: typeof Tag; label: string; bgColor: string; textColor: string }> = {
  initial: { 
    icon: Tag, 
    label: 'Nota do Agendamento', 
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600 dark:text-blue-400'
  },
  reschedule: { 
    icon: ArrowRightLeft, 
    label: 'Reagendamento', 
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-600 dark:text-yellow-400'
  },
  general: { 
    icon: MessageCircle, 
    label: 'Nota adicional', 
    bgColor: 'bg-muted/50',
    textColor: 'text-muted-foreground'
  },
};

function NoteItem({ 
  note, 
  canDelete, 
  onDelete 
}: { 
  note: AttendeeNote; 
  canDelete: boolean; 
  onDelete: () => void;
}) {
  const config = NOTE_TYPE_CONFIG[note.note_type] || NOTE_TYPE_CONFIG.general;
  const Icon = config.icon;
  
  return (
    <div className={cn('rounded-lg p-3 space-y-2', config.bgColor)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', config.textColor)} />
          <span className={cn('text-xs font-medium', config.textColor)}>
            {config.label}
          </span>
        </div>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      <p className="text-sm whitespace-pre-wrap">{note.note}</p>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}
        </span>
        {note.created_by_profile && (
          <span>· {note.created_by_profile.full_name || note.created_by_profile.email}</span>
        )}
      </div>
    </div>
  );
}

export function AttendeeNotesSection({ 
  attendeeId, 
  participantName,
  canAddNotes = true 
}: AttendeeNotesSectionProps) {
  const { user } = useAuth();
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  const { data: notes = [], isLoading } = useAttendeeNotes(attendeeId);
  const addNote = useAddAttendeeNote();
  const deleteNote = useDeleteAttendeeNote();

  const handleAddNote = () => {
    if (!newNote.trim() || !attendeeId) {
      toast.error('Digite uma nota');
      return;
    }
    
    addNote.mutate(
      { attendeeId, note: newNote.trim(), noteType: 'general' },
      {
        onSuccess: () => {
          setNewNote('');
          setShowAddNote(false);
          toast.success('Nota adicionada!');
        },
        onError: () => {
          toast.error('Erro ao adicionar nota');
        }
      }
    );
  };

  const handleDeleteNote = (noteId: string) => {
    if (!attendeeId) return;
    
    deleteNote.mutate(
      { noteId, attendeeId },
      {
        onSuccess: () => {
          toast.success('Nota removida');
        },
        onError: () => {
          toast.error('Erro ao remover nota');
        }
      }
    );
  };

  if (!attendeeId) return null;

  const firstName = participantName?.split(' ')[0] || 'Participante';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Notas sobre {firstName}
        </h4>
        {canAddNotes && !showAddNote && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddNote(true)}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Nova nota
          </Button>
        )}
      </div>

      {/* Add note form */}
      {showAddNote && (
        <div className="space-y-2 bg-muted/30 rounded-lg p-3">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={`Adicione uma nota sobre ${firstName}...`}
            rows={3}
            className="bg-background"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddNote(false);
                setNewNote('');
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={addNote.isPending || !newNote.trim()}
            >
              <Send className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          Carregando notas...
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-4 bg-muted/20 rounded-lg">
          Nenhuma nota registrada
        </div>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                canDelete={note.created_by === user?.id}
                onDelete={() => handleDeleteNote(note.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
