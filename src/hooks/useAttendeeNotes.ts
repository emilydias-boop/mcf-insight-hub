import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type NoteType = 'initial' | 'reschedule' | 'general' | 'r2';

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
 * If dealId is provided, also fetches notes from all historical attendees for the same deal
 */
export function useAttendeeNotes(
  attendeeId: string | null | undefined,
  dealId?: string | null
) {
  return useQuery({
    queryKey: ['attendee-notes', attendeeId, dealId],
    queryFn: async () => {
      if (!attendeeId && !dealId) return [];
      
      // Build list of attendee IDs to fetch notes for
      let allAttendeeIds: string[] = [];
      
      // If dealId is provided, fetch all attendee IDs for this deal (historical + current)
      if (dealId) {
        const { data: allAttendees } = await supabase
          .from('meeting_slot_attendees')
          .select('id')
          .eq('deal_id', dealId);
        
        allAttendeeIds = (allAttendees || []).map(a => a.id);
      }
      
      // Add current attendeeId if not already in the list
      if (attendeeId && !allAttendeeIds.includes(attendeeId)) {
        allAttendeeIds.push(attendeeId);
      }
      
      // Fallback: if no IDs found, use just the attendeeId
      if (allAttendeeIds.length === 0 && attendeeId) {
        allAttendeeIds = [attendeeId];
      }
      
      if (allAttendeeIds.length === 0) return [];
      
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
        .in('attendee_id', allAttendeeIds)
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
    enabled: !!(attendeeId || dealId),
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
      queryClient.refetchQueries({ queryKey: ['attendee-notes', variables.attendeeId] });
      // Also invalidate queries that might include dealId
      queryClient.invalidateQueries({ queryKey: ['attendee-notes'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['lead-notes'] });
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
      // Also invalidate all attendee-notes queries
      queryClient.invalidateQueries({ queryKey: ['attendee-notes'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-meetings'] });
    },
  });
}
