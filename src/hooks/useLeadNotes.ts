import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type NoteType = 'manual' | 'scheduling' | 'call' | 'closer' | 'r2' | 'qualification';

export interface LeadNote {
  id: string;
  type: NoteType;
  content: string;
  author: string | null;
  created_at: string;
}

/**
 * Fetch all notes related to a lead from various sources
 * Now fetches notes from ALL attendees of a deal (R1, R2, etc.)
 */
export function useLeadNotes(dealId: string | null | undefined, attendeeId: string | null | undefined) {
  return useQuery({
    queryKey: ['lead-notes', dealId, attendeeId],
    queryFn: async (): Promise<LeadNote[]> => {
      const notes: LeadNote[] = [];
      
      // =============================================
      // Fetch ALL attendeeIds for this deal
      // This ensures we get notes from R1, R2, etc.
      // =============================================
      let allAttendeeIds: string[] = [];
      
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
      
      // 1. Fetch deal activities (manual notes + qualification notes)
      if (dealId) {
        const { data: activities } = await supabase
          .from('deal_activities')
          .select('id, activity_type, description, created_at, user_id')
          .eq('deal_id', dealId)
          .in('activity_type', ['note', 'qualification_note'])
          .order('created_at', { ascending: false });
        
        if (activities) {
          // Fetch user names
          const userIds = activities.map(a => a.user_id).filter(Boolean) as string[];
          let userMap: Record<string, string> = {};
          
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', userIds);
            
            if (profiles) {
              profiles.forEach(p => {
                userMap[p.id] = p.full_name || 'Usuário';
              });
            }
          }
          
          activities.forEach(act => {
            if (act.description) {
              notes.push({
                id: act.id,
                type: act.activity_type === 'qualification_note' ? 'qualification' : 'manual',
                content: act.description,
                author: act.user_id ? userMap[act.user_id] || null : null,
                created_at: act.created_at || new Date().toISOString(),
              });
            }
          });
        }
      }
      
      // 2. Fetch attendee notes from ALL attendees of this deal
      if (allAttendeeIds.length > 0) {
        const { data: attendeeNotes } = await supabase
          .from('attendee_notes')
          .select('id, note, note_type, created_at, created_by')
          .in('attendee_id', allAttendeeIds)
          .order('created_at', { ascending: false });
        
        if (attendeeNotes) {
          const creatorIds = attendeeNotes.map(n => n.created_by).filter(Boolean) as string[];
          let creatorMap: Record<string, string> = {};
          
          if (creatorIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', creatorIds);
            
            if (profiles) {
              profiles.forEach(p => {
                creatorMap[p.id] = p.full_name || 'Usuário';
              });
            }
          }
          
          attendeeNotes.forEach(note => {
            notes.push({
              id: note.id,
              type: (note.note_type as NoteType) || 'closer',
              content: note.note,
              author: note.created_by ? creatorMap[note.created_by] || null : null,
              created_at: note.created_at || new Date().toISOString(),
            });
          });
        }
      }
      
      // 3. Fetch scheduling notes from meeting_slot_attendees.notes
      if (allAttendeeIds.length > 0) {
        const { data: schedulingNotes } = await supabase
          .from('meeting_slot_attendees')
          .select('id, notes, created_at')
          .in('id', allAttendeeIds)
          .not('notes', 'is', null);
        
        if (schedulingNotes) {
          schedulingNotes.forEach(sn => {
            if (sn.notes) {
              notes.push({
                id: `scheduling-${sn.id}`,
                type: 'scheduling',
                content: sn.notes,
                author: null,
                created_at: sn.created_at || new Date().toISOString(),
              });
            }
          });
        }
      }
      
      // 4. Fetch call notes
      if (dealId) {
        const { data: calls } = await supabase
          .from('calls')
          .select('id, notes, created_at, user_id')
          .eq('deal_id', dealId)
          .not('notes', 'is', null)
          .order('created_at', { ascending: false });
        
        if (calls) {
          const userIds = calls.map(c => c.user_id).filter(Boolean) as string[];
          let userMap: Record<string, string> = {};
          
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', userIds);
            
            if (profiles) {
              profiles.forEach(p => {
                userMap[p.id] = p.full_name || 'Usuário';
              });
            }
          }
          
          calls.forEach(call => {
            if (call.notes) {
              notes.push({
                id: call.id,
                type: 'call',
                content: call.notes,
                author: call.user_id ? userMap[call.user_id] || null : null,
                created_at: call.created_at || new Date().toISOString(),
              });
            }
          });
        }
      }
      
      // Sort all notes by date descending
      notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return notes;
    },
    enabled: !!(dealId || attendeeId),
  });
}
