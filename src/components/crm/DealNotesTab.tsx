import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAddDealNote } from '@/hooks/useNextAction';
import { Send, StickyNote, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DealNotesTabProps {
  dealId: string;
}

export const DealNotesTab = ({ dealId }: DealNotesTabProps) => {
  const [newNote, setNewNote] = useState('');
  const addNote = useAddDealNote();
  
  const { data: notes, isLoading } = useQuery({
    queryKey: ['deal-notes', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .eq('activity_type', 'note')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!dealId,
  });
  
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    await addNote.mutateAsync({ dealId, note: newNote.trim() });
    setNewNote('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleAddNote();
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Input para nova nota */}
      <div className="space-y-2">
        <Textarea
          placeholder="Escreva uma observação... (Ctrl+Enter para enviar)"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[80px] bg-background resize-none"
        />
        <Button 
          onClick={handleAddNote} 
          disabled={!newNote.trim() || addNote.isPending}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {addNote.isPending ? 'Salvando...' : 'Adicionar Nota'}
        </Button>
      </div>
      
      {/* Lista de notas */}
      <ScrollArea className="h-[250px]">
        {notes && notes.length > 0 ? (
          <div className="space-y-3">
            {notes.map((note) => {
              const metadata = note.metadata as Record<string, any> | null;
              return (
                <div 
                  key={note.id} 
                  className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2"
                >
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {note.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{metadata?.author || 'Usuário'}</span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(note.created_at!), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <StickyNote className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma nota ainda</p>
            <p className="text-xs">Adicione observações sobre este negócio</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
