import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAddDealNote } from '@/hooks/useNextAction';
import { useContactDealIds } from '@/hooks/useContactDealIds';
import { Send, StickyNote, User, Calendar, Phone, MessageCircle, ArrowRightLeft, ClipboardList, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DealNotesTabProps {
  dealUuid: string;
  dealClintId?: string;
  contactId?: string | null;
}

type NoteType = 'manual' | 'scheduling' | 'attendee' | 'reschedule' | 'call' | 'qualification' | 'closer';

interface CombinedNote {
  id: string;
  content: string;
  created_at: string;
  type: NoteType;
  author: string;
  meetingType?: string;
  closerName?: string;
  outcome?: string;
}

const NOTE_STYLES: Record<NoteType, { bg: string; border: string; color: string; label: string }> = {
  manual: { bg: 'bg-secondary/30', border: 'border-border', color: 'text-muted-foreground', label: 'Nota' },
  scheduling: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', color: 'text-amber-600', label: 'Agendamento' },
  attendee: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', color: 'text-blue-600', label: 'Nota do Closer' },
  reschedule: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', color: 'text-yellow-600', label: 'Reagendamento' },
  call: { bg: 'bg-green-500/10', border: 'border-green-500/30', color: 'text-green-600', label: 'Ligação' },
  qualification: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', color: 'text-purple-600', label: 'Qualificação' },
  closer: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', color: 'text-indigo-600', label: 'Pós-Reunião' },
};

const NOTE_ICONS: Record<NoteType, React.ReactNode> = {
  manual: <StickyNote className="h-3 w-3" />,
  scheduling: <Calendar className="h-3 w-3" />,
  attendee: <MessageCircle className="h-3 w-3" />,
  reschedule: <ArrowRightLeft className="h-3 w-3" />,
  call: <Phone className="h-3 w-3" />,
  qualification: <ClipboardList className="h-3 w-3" />,
  closer: <UserCheck className="h-3 w-3" />,
};

export const DealNotesTab = ({ dealUuid, dealClintId, contactId }: DealNotesTabProps) => {
  const [newNote, setNewNote] = useState('');
  const addNote = useAddDealNote();
  const { data: allDealIds = [] } = useContactDealIds(dealUuid, contactId);
  
  // Combine all IDs
  const uniqueIds = [...new Set([...allDealIds, dealUuid, ...(dealClintId ? [dealClintId] : [])].filter(Boolean))];
  
  const { data: allNotes, isLoading } = useQuery({
    queryKey: ['all-deal-notes', uniqueIds],
    queryFn: async () => {
      // 1. Notas manuais + qualificação (deal_activities) - ALL deals cross-pipeline
      const { data: manualNotes } = await supabase
        .from('deal_activities')
        .select('id, description, created_at, metadata, activity_type')
        .in('deal_id', uniqueIds)
        .in('activity_type', ['note', 'qualification_note']);
      
      // 2. Notas de agendamento + closer_notes (meeting_slot_attendees) - ALL deals
      const { data: attendees } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id, notes, closer_notes, created_at, booked_by,
          meeting_slots(meeting_type, scheduled_at, closers(name))
      `)
        .in('deal_id', uniqueIds);
      
      // 3. Buscar attendee_notes para cada attendee encontrado
      const attendeeIds = attendees?.map(a => a.id) || [];
      const { data: attendeeNotes } = attendeeIds.length > 0 
        ? await supabase
            .from('attendee_notes')
            .select('id, note, note_type, created_at, created_by')
            .in('attendee_id', attendeeIds)
        : { data: [] };
      
      // Buscar perfis dos criadores de attendee_notes
      const creatorIds = attendeeNotes?.map(n => n.created_by).filter(Boolean) as string[] || [];
      const { data: creatorProfiles } = creatorIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', creatorIds)
        : { data: [] };
      
      const creatorMap = new Map<string, string>();
      creatorProfiles?.forEach(p => creatorMap.set(p.id, p.full_name || 'Usuário'));
      
      // Buscar perfis dos booked_by
      const bookedByIds = attendees?.map(a => a.booked_by).filter(Boolean) as string[] || [];
      const { data: bookedByProfiles } = bookedByIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', bookedByIds)
        : { data: [] };
      
      const bookedByMap = new Map<string, string>();
      bookedByProfiles?.forEach(p => bookedByMap.set(p.id, p.full_name || 'SDR'));
      
      // 4. Notas de ligação (calls) - ALL deals
      const { data: callNotes } = await supabase
        .from('calls')
        .select('id, notes, outcome, created_at, user_id')
        .in('deal_id', uniqueIds)
        .not('notes', 'is', null);
      
      // Buscar perfis dos usuários de calls
      const callUserIds = callNotes?.map(c => c.user_id).filter(Boolean) as string[] || [];
      const { data: callUserProfiles } = callUserIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', callUserIds)
        : { data: [] };
      
      const callUserMap = new Map<string, string>();
      callUserProfiles?.forEach(p => callUserMap.set(p.id, p.full_name || 'SDR'));
      
      // Combinar todas as fontes
      const combined: CombinedNote[] = [
        // Notas manuais + qualificação
        ...(manualNotes || []).map(n => ({
          id: n.id,
          content: n.description || '',
          created_at: n.created_at!,
          type: (n.activity_type === 'qualification_note' ? 'qualification' : 'manual') as NoteType,
          author: (n.metadata as Record<string, any>)?.sdr_name 
            || (n.metadata as Record<string, any>)?.author 
            || 'Usuário'
        })),
        
        // Notas de agendamento (SDR notes)
        ...(attendees || [])
          .filter(a => a.notes?.trim())
          .map(a => {
            const slots = a.meeting_slots as any;
            return {
              id: `scheduling-${a.id}`,
              content: a.notes!,
              created_at: a.created_at!,
              type: 'scheduling' as const,
              author: bookedByMap.get(a.booked_by!) || 'SDR',
              meetingType: slots?.meeting_type?.toUpperCase(),
              closerName: slots?.closers?.name
            };
          }),
        
        // Notas pós-reunião do closer (closer_notes)
        ...(attendees || [])
          .filter(a => (a as any).closer_notes?.trim())
          .map(a => {
            const slots = a.meeting_slots as any;
            return {
              id: `closer-${a.id}`,
              content: (a as any).closer_notes!,
              created_at: a.created_at!,
              type: 'closer' as const,
              author: slots?.closers?.name || 'Closer',
              meetingType: slots?.meeting_type?.toUpperCase(),
              closerName: slots?.closers?.name
            };
          }),
        
        // Notas de attendee (closers/reagendamentos)
        ...(attendeeNotes || []).map(n => ({
          id: n.id,
          content: n.note,
          created_at: n.created_at!,
          type: (n.note_type === 'reschedule' ? 'reschedule' : 'attendee') as NoteType,
          author: creatorMap.get(n.created_by!) || 'Usuário'
        })),
        
        // Notas de ligação
        ...(callNotes || [])
          .filter(c => c.notes?.trim())
          .map(c => ({
            id: `call-${c.id}`,
            content: c.notes!,
            created_at: c.created_at!,
            type: 'call' as const,
            author: callUserMap.get(c.user_id!) || 'SDR',
            outcome: c.outcome || undefined
          }))
      ];
      
      // Ordenar por data (mais recente primeiro)
      return combined.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: uniqueIds.length > 0,
  });
  
  const handleAddNote = async () => {
    if (!newNote.trim() || !dealUuid) return;
    await addNote.mutateAsync({ dealId: dealUuid, note: newNote.trim() });
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
        {allNotes && allNotes.length > 0 ? (
          <div className="space-y-3">
            {allNotes.map((note) => {
              const style = NOTE_STYLES[note.type];
              const icon = NOTE_ICONS[note.type];
              
              let label = style.label;
              if (note.type === 'scheduling' && note.meetingType) {
                label = `${note.meetingType}${note.closerName ? `: ${note.closerName}` : ''}`;
              } else if (note.type === 'closer' && note.closerName) {
                label = `Pós-Reunião: ${note.closerName}`;
              } else if (note.type === 'call' && note.outcome) {
                label = `Ligação - ${note.outcome}`;
              }
              
              return (
                <div 
                  key={note.id} 
                  className={`rounded-lg border ${style.border} ${style.bg} p-3 space-y-2`}
                >
                  <div className={`flex items-center gap-2 text-xs ${style.color}`}>
                    {icon}
                    <span className="font-medium">{label}</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {note.content}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{note.author}</span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(note.created_at), { 
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
