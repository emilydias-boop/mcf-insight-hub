import { useState } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Send, FileText, ShoppingCart, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { R2AttendeeExtended } from '@/types/r2Agenda';
import { useLeadNotes, NoteType } from '@/hooks/useLeadNotes';
import { useLeadPurchaseHistory } from '@/hooks/useLeadPurchaseHistory';
import { useAddAttendeeNote } from '@/hooks/useAttendeeNotes';

interface R2NotesTabProps {
  attendee: R2AttendeeExtended;
}

const NOTE_TYPE_STYLES: Record<NoteType, { bg: string; label: string }> = {
  manual: { bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800', label: 'Nota SDR' },
  scheduling: { bg: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800', label: 'Agendamento' },
  call: { bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800', label: 'Ligação' },
  closer: { bg: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800', label: 'Closer' },
  r2: { bg: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800', label: 'R2' },
  qualification: { bg: 'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800', label: 'Qualificação' },
};

const PURCHASE_STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  completed: { icon: '✓', color: 'text-green-600' },
  refunded: { icon: '↩', color: 'text-orange-500' },
  pending: { icon: '⏳', color: 'text-yellow-600' },
};

export function R2NotesTab({ attendee }: R2NotesTabProps) {
  const [showNotes, setShowNotes] = useState(true);
  const [showPurchases, setShowPurchases] = useState(true);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  
  const contactEmail = attendee?.deal?.contact?.email;
  const { data: leadNotes } = useLeadNotes(attendee?.deal_id, attendee?.id);
  const { data: purchaseHistory } = useLeadPurchaseHistory(contactEmail);
  const addNote = useAddAttendeeNote();

  const handleAddNote = () => {
    if (!newNoteText.trim() || !attendee?.id) {
      toast.error('Digite uma nota');
      return;
    }
    addNote.mutate(
      { attendeeId: attendee.id, note: newNoteText.trim(), noteType: 'r2' },
      {
        onSuccess: () => {
          setNewNoteText('');
          setShowAddNoteForm(false);
          toast.success('Nota adicionada!');
        },
        onError: () => {
          toast.error('Erro ao adicionar nota');
        }
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Notas do Lead */}
      <Collapsible open={showNotes} onOpenChange={setShowNotes}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              📝 Notas do Lead
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{leadNotes?.length || 0}</Badge>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showNotes && "rotate-180")} />
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {/* Add note form */}
          {!showAddNoteForm ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAddNoteForm(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar Nota
            </Button>
          ) : (
            <div className="space-y-2 bg-muted/30 rounded-lg p-3">
              <Textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Digite sua nota sobre este lead..."
                rows={3}
                className="bg-background"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddNoteForm(false);
                    setNewNoteText('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={addNote.isPending || !newNoteText.trim()}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {/* Notes list */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(!leadNotes || leadNotes.length === 0) && !showAddNoteForm && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma nota encontrada
              </p>
            )}
            {leadNotes?.map(note => {
              const style = NOTE_TYPE_STYLES[note.type] || NOTE_TYPE_STYLES.manual;
              return (
                <div key={note.id} className={cn("rounded-lg p-2 border text-sm", style.bg)}>
                  <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                    <span className="font-medium">{style.label}</span>
                    <span>
                      {note.author && `${note.author} • `}
                      {formatDistanceToNow(parseISO(note.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-foreground">{note.content}</p>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Histórico de Compras */}
      <Collapsible open={showPurchases} onOpenChange={setShowPurchases}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              🛒 Histórico de Compras
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{purchaseHistory?.length || 0}</Badge>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showPurchases && "rotate-180")} />
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(!purchaseHistory || purchaseHistory.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma compra encontrada
              </p>
            )}
            {purchaseHistory?.map(purchase => {
              const statusStyle = PURCHASE_STATUS_ICONS[purchase.sale_status] || PURCHASE_STATUS_ICONS.pending;
              return (
                <div key={purchase.id} className="flex justify-between items-center p-2 border rounded-lg text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={statusStyle.color}>{statusStyle.icon}</span>
                      <span className="font-medium">{purchase.product_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(purchase.sale_date), 'dd/MM/yyyy')} • {purchase.sale_status}
                    </div>
                  </div>
                  <div className="font-medium">
                    R$ {purchase.product_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
