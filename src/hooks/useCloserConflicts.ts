import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ConflictingTime {
  time: string; // HH:mm format
  closerId: string;
  relatedCloserId: string;
  bu: string | null;
}

interface CloserConflictsResult {
  conflictingTimes: ConflictingTime[];
  relatedCloserIds: string[];
}

/**
 * Hook to fetch cross-BU conflicts for a list of closers.
 * Uses employee_id to find related closer records and checks their meeting_slots.
 * 
 * @param closerIds - Array of closer IDs to check for conflicts
 * @param date - The date to check for conflicts
 * @returns Conflicting times from meetings in other BUs
 */
export function useCloserCrossBUConflicts(closerIds: string[], date: Date | undefined) {
  return useQuery({
    queryKey: ['closer-cross-bu-conflicts', closerIds, date ? format(date, 'yyyy-MM-dd') : null],
    queryFn: async (): Promise<CloserConflictsResult> => {
      if (!closerIds.length || !date) {
        return { conflictingTimes: [], relatedCloserIds: [] };
      }

      const dateStr = format(date, 'yyyy-MM-dd');
      const startOfDayStr = `${dateStr}T00:00:00`;
      const endOfDayStr = `${dateStr}T23:59:59`;

      // 1. Get employee_ids for all provided closers
      const { data: closersData, error: closersError } = await supabase
        .from('closers')
        .select('id, employee_id, bu')
        .in('id', closerIds);

      if (closersError) throw closersError;

      // Build a map: closerId -> employee_id
      const closerEmployeeMap = new Map<string, string | null>();
      const employeeIds = new Set<string>();
      
      for (const closer of closersData || []) {
        closerEmployeeMap.set(closer.id, closer.employee_id);
        if (closer.employee_id) {
          employeeIds.add(closer.employee_id);
        }
      }

      // If no employee_ids found, no cross-BU conflicts possible
      if (employeeIds.size === 0) {
        return { conflictingTimes: [], relatedCloserIds: [] };
      }

      // 2. Find ALL closers that share the same employee_ids (including other BUs)
      const { data: allRelatedClosers, error: relatedError } = await supabase
        .from('closers')
        .select('id, employee_id, bu')
        .in('employee_id', Array.from(employeeIds));

      if (relatedError) throw relatedError;

      // Build map: employee_id -> all closer_ids with that employee
      const employeeClosersMap = new Map<string, Array<{ id: string; bu: string | null }>>();
      
      for (const closer of allRelatedClosers || []) {
        if (!closer.employee_id) continue;
        
        if (!employeeClosersMap.has(closer.employee_id)) {
          employeeClosersMap.set(closer.employee_id, []);
        }
        employeeClosersMap.get(closer.employee_id)!.push({ id: closer.id, bu: closer.bu });
      }

      // Get IDs of closers in OTHER BUs (not in the original closerIds list)
      const relatedCloserIds = (allRelatedClosers || [])
        .filter(c => !closerIds.includes(c.id))
        .map(c => c.id);

      if (relatedCloserIds.length === 0) {
        return { conflictingTimes: [], relatedCloserIds: [] };
      }

      // 3. Fetch meetings from these related closers (other BUs) on this date
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_slots')
        .select('scheduled_at, closer_id, duration_minutes')
        .in('closer_id', relatedCloserIds)
        .gte('scheduled_at', startOfDayStr)
        .lte('scheduled_at', endOfDayStr)
        .in('status', ['scheduled', 'rescheduled']);

      if (meetingsError) throw meetingsError;

      // 4. Build conflict list - map each meeting to the original closer(s) it affects
      const conflictingTimes: ConflictingTime[] = [];

      for (const meeting of meetings || []) {
        const meetingTime = format(new Date(meeting.scheduled_at), 'HH:mm');
        
        // Find which original closer(s) share the same employee_id as this meeting's closer
        const meetingCloser = (allRelatedClosers || []).find(c => c.id === meeting.closer_id);
        if (!meetingCloser?.employee_id) continue;

        // For each original closer that shares this employee_id, add a conflict
        for (const originalCloserId of closerIds) {
          const originalEmployeeId = closerEmployeeMap.get(originalCloserId);
          
          if (originalEmployeeId === meetingCloser.employee_id) {
            conflictingTimes.push({
              time: meetingTime,
              closerId: originalCloserId,
              relatedCloserId: meeting.closer_id,
              bu: meetingCloser.bu,
            });
          }
        }
      }

      return { conflictingTimes, relatedCloserIds };
    },
    enabled: closerIds.length > 0 && !!date,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch cross-BU conflicts for a single closer.
 * Convenience wrapper around useCloserCrossBUConflicts.
 */
export function useCloserConflicts(closerId: string | undefined, date: Date | undefined) {
  const result = useCloserCrossBUConflicts(
    closerId ? [closerId] : [], 
    date
  );
  
  return {
    ...result,
    data: result.data ? {
      conflictingTimes: result.data.conflictingTimes.map(c => c.time),
      relatedCloserIds: result.data.relatedCloserIds,
    } : undefined,
  };
}

/**
 * Hook to check if an employee already has closer records in other BUs.
 * Used in CloserFormDialog to show a warning.
 */
export function useExistingClosersForEmployee(employeeId: string | undefined, currentBu?: string) {
  return useQuery({
    queryKey: ['existing-closers-for-employee', employeeId, currentBu],
    queryFn: async () => {
      if (!employeeId) return [];

      let query = supabase
        .from('closers')
        .select('id, name, bu, meeting_type')
        .eq('employee_id', employeeId);

      // If currentBu is provided, exclude closers from that BU
      if (currentBu) {
        query = query.neq('bu', currentBu);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });
}
