import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBU } from '@/hooks/useActiveBU';

export interface StatusChangeEntry {
  id: string;
  old_status: string;
  new_status: string;
  changed_at: string;
  changed_by_name: string | null;
  changed_by_id: string | null;
  attendee_name: string | null;
  closer_name: string | null;
  closer_bu: string | null;
  meeting_type: string | null;
  scheduled_at: string | null;
  is_suspicious: boolean;
}

const SUSPICIOUS_TRANSITIONS: [string, string][] = [
  ['no_show', 'completed'],
  ['completed', 'no_show'],
  ['no_show', 'invited'],
  ['completed', 'invited'],
];

function isSuspicious(oldStatus: string, newStatus: string): boolean {
  return SUSPICIOUS_TRANSITIONS.some(([o, n]) => o === oldStatus && n === newStatus);
}

interface UseStatusChangeAuditParams {
  days: number;
  closerId?: string | null;
  suspiciousOnly?: boolean;
}

export function useStatusChangeAudit({ days, closerId, suspiciousOnly }: UseStatusChangeAuditParams) {
  const activeBU = useActiveBU();

  return useQuery({
    queryKey: ['status-change-audit', days, closerId, suspiciousOnly, activeBU],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Get audit logs for meeting_slot_attendees status changes
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('id, user_id, action, record_id, old_data, new_data, created_at')
        .eq('table_name', 'meeting_slot_attendees')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Filter only status changes
      const statusChanges = (logs || []).filter(log => {
        const oldData = log.old_data as Record<string, unknown> | null;
        const newData = log.new_data as Record<string, unknown> | null;
        if (!oldData || !newData) return false;
        return oldData.status !== newData.status;
      });

      if (statusChanges.length === 0) return [];

      // Get attendee IDs for enrichment
      const attendeeIds = [...new Set(statusChanges.map(l => l.record_id).filter(Boolean))];
      const userIds = [...new Set(statusChanges.map(l => l.user_id).filter(Boolean))];

      // Fetch attendees with slots and closers
      const { data: attendees } = await supabase
        .from('meeting_slot_attendees')
        .select('id, attendee_name, slot_id')
        .in('id', attendeeIds);

      const slotIds = [...new Set((attendees || []).map(a => a.slot_id).filter(Boolean))];

      const { data: slots } = slotIds.length > 0
        ? await supabase
            .from('meeting_slots')
            .select('id, closer_id, scheduled_at, meeting_type')
            .in('id', slotIds)
        : { data: [] };

      const closerIds = [...new Set((slots || []).map(s => s.closer_id).filter(Boolean))];

      const { data: closers } = closerIds.length > 0
        ? await supabase
            .from('closers')
            .select('id, name, bu')
            .in('id', closerIds)
        : { data: [] };

      // Fetch changer profiles
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds)
        : { data: [] };

      // Build lookup maps
      const attendeeMap = new Map((attendees || []).map(a => [a.id, a]));
      const slotMap = new Map((slots || []).map(s => [s.id, s]));
      const closerMap = new Map((closers || []).map(c => [c.id, c]));
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Build entries
      const entries: StatusChangeEntry[] = statusChanges.map(log => {
        const oldData = log.old_data as Record<string, unknown>;
        const newData = log.new_data as Record<string, unknown>;
        const oldStatus = String(oldData.status || '');
        const newStatus = String(newData.status || '');

        const attendee = attendeeMap.get(log.record_id || '');
        const slot = attendee ? slotMap.get(attendee.slot_id) : null;
        const closer = slot ? closerMap.get(slot.closer_id) : null;
        const profile = log.user_id ? profileMap.get(log.user_id) : null;

        return {
          id: log.id,
          old_status: oldStatus,
          new_status: newStatus,
          changed_at: log.created_at || '',
          changed_by_name: profile?.full_name || profile?.email || null,
          changed_by_id: log.user_id,
          attendee_name: attendee?.attendee_name || attendee?.name || null,
          closer_name: closer?.name || null,
          closer_bu: closer?.bu || null,
          meeting_type: slot?.meeting_type || null,
          scheduled_at: slot?.scheduled_at || null,
          is_suspicious: isSuspicious(oldStatus, newStatus),
        };
      });

      // Filter by BU
      let filtered = activeBU && activeBU !== 'incorporador'
        ? entries.filter(e => e.closer_bu === activeBU)
        : entries;

      // Filter by closer
      if (closerId) {
        filtered = filtered.filter(e => {
          // closerId is closer name match for simplicity
          return true; // We'll filter in the component by closer_name
        });
      }

      // Filter suspicious only
      if (suspiciousOnly) {
        filtered = filtered.filter(e => e.is_suspicious);
      }

      return filtered;
    },
  });
}
