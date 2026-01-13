import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type NoteType = 'initial' | 'reschedule' | 'general';

export interface AttendeeNote {
  id: string;
  attendee_id: string;
  note: string;
  note_type: NoteType;
  created_by: string | null;
  created_at: string;
  created_by_profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

/**
 * Fetch all notes for a specific attendee
 */
export function useAttendeeNotes(attendeeId: string | null | undefined) {
  return useQuery({
    queryKey: ['attendee-notes', attendeeId],
    queryFn: async () => {
      if (!attendeeId) return [];
      
      const { data, error } = await supabase
        .from('attendee_notes')
        .select(`
          id,
          attendee_id,
          note,
          note_type,
          created_by,
          created_at
        `)
        .eq('attendee_id', attendeeId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Fetch profile info for each note creator
      const notes = data || [];
      const creatorIds = [...new Set(notes.map(n => n.created_by).filter(Boolean))];
      
      let profilesMap = new Map();
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', creatorIds);
        
        if (profiles) {
          profilesMap = new Map(profiles.map(p => [p.id, p]));
        }
      }
      
      return notes.map(note => ({
        ...note,
        note_type: note.note_type as NoteType,
        created_by_profile: note.created_by ? profilesMap.get(note.created_by) || null : null,
      })) as AttendeeNote[];
    },
    enabled: !!attendeeId,
  });
}

/**
 * Add a new note to an attendee
 */
export function useAddAttendeeNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      attendeeId, 
      note, 
      noteType = 'general' 
    }: { 
      attendeeId: string; 
      note: string; 
      noteType?: NoteType;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('attendee_notes')
        .insert({
          attendee_id: attendeeId,
          note,
          note_type: noteType,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendee-notes', variables.attendeeId] });
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
    },
  });
}

/**
 * Delete a note (only the creator can delete)
 */
export function useDeleteAttendeeNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ noteId, attendeeId }: { noteId: string; attendeeId: string }) => {
      const { error } = await supabase
        .from('attendee_notes')
        .delete()
        .eq('id', noteId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendee-notes', variables.attendeeId] });
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
    },
  });
}
