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
  attendee_id: string | null;
  attendee_phone: string | null;
  closer_name: string | null;
  closer_bu: string | null;
  meeting_type: string | null;
  scheduled_at: string | null;
  is_suspicious: boolean;
  is_normal_flow: boolean;
  deal_id: string | null;
  contact_id: string | null;
  notes: string | null;
  r2_observations: string | null;
  closer_notes: string | null;
  meeting_link: string | null;
  video_status: string | null;
  lead_profile: string | null;
  is_reschedule: boolean;
  suspension_reason: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

const SUSPICIOUS_TRANSITIONS: [string, string][] = [
  ['no_show', 'completed'],
  ['completed', 'no_show'],
  ['no_show', 'invited'],
  ['completed', 'invited'],
  ['no_show', 'scheduled'],
  ['completed', 'scheduled'],
  ['cancelled', 'completed'],
  ['refunded', 'completed'],
  ['cancelled', 'scheduled'],
  ['cancelled', 'invited'],
];

const NORMAL_FLOW_TRANSITIONS: [string, string][] = [
  ['pre_scheduled', 'invited'],
  ['pre_scheduled', 'scheduled'],
  ['invited', 'scheduled'],
  ['invited', 'confirmed'],
  ['scheduled', 'confirmed'],
  ['confirmed', 'completed'],
  ['scheduled', 'completed'],
  ['invited', 'completed'],
];

function isSuspicious(oldStatus: string, newStatus: string): boolean {
  return SUSPICIOUS_TRANSITIONS.some(([o, n]) => o === oldStatus && n === newStatus);
}

function isNormalFlow(oldStatus: string, newStatus: string): boolean {
  return NORMAL_FLOW_TRANSITIONS.some(([o, n]) => o === oldStatus && n === newStatus);
}

export type AuditFilterMode = 'all' | 'suspicious' | 'manual';

interface UseStatusChangeAuditParams {
  days: number;
  closerId?: string | null;
  filterMode?: AuditFilterMode;
}

export function useStatusChangeAudit({ days, closerId, filterMode = 'manual' }: UseStatusChangeAuditParams) {
  const activeBU = useActiveBU();

  return useQuery({
    queryKey: ['status-change-audit', days, closerId, filterMode, activeBU],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('id, user_id, action, record_id, old_data, new_data, created_at')
        .eq('table_name', 'meeting_slot_attendees')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;

      const statusChanges = (logs || []).filter(log => {
        const oldData = log.old_data as Record<string, unknown> | null;
        const newData = log.new_data as Record<string, unknown> | null;
        if (!oldData || !newData) return false;
        return oldData.status !== newData.status;
      });

      if (statusChanges.length === 0) return [];

      const attendeeIds = [...new Set(statusChanges.map(l => l.record_id).filter(Boolean))];
      const userIds = [...new Set(statusChanges.map(l => l.user_id).filter(Boolean))];

      const { data: attendees } = await supabase
        .from('meeting_slot_attendees')
        .select('id, attendee_name, meeting_slot_id')
        .in('id', attendeeIds);

      const slotIds = [...new Set((attendees || []).map(a => a.meeting_slot_id).filter(Boolean))];

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

      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds)
        : { data: [] };

      const attendeeMap = new Map((attendees || []).map(a => [a.id, a]));
      const slotMap = new Map((slots || []).map(s => [s.id, s]));
      const closerMap = new Map((closers || []).map(c => [c.id, c]));
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const entries: StatusChangeEntry[] = statusChanges.map(log => {
        const oldData = log.old_data as Record<string, unknown>;
        const newData = log.new_data as Record<string, unknown>;
        const oldStatus = String(oldData.status || '');
        const newStatus = String(newData.status || '');

        const attendee = attendeeMap.get(log.record_id || '');
        const slot = attendee ? slotMap.get(attendee.meeting_slot_id) : null;
        const closer = slot ? closerMap.get(slot.closer_id) : null;
        const profile = log.user_id ? profileMap.get(log.user_id) : null;

        const suspicious = isSuspicious(oldStatus, newStatus);
        const normalFlow = isNormalFlow(oldStatus, newStatus);

        return {
          id: log.id,
          old_status: oldStatus,
          new_status: newStatus,
          changed_at: log.created_at || '',
          changed_by_name: profile?.full_name || profile?.email || null,
          changed_by_id: log.user_id,
          attendee_name: attendee?.attendee_name || null,
          attendee_id: log.record_id || null,
          attendee_phone: String(newData.attendee_phone || oldData.attendee_phone || '') || null,
          closer_name: closer?.name || null,
          closer_bu: closer?.bu || null,
          meeting_type: slot?.meeting_type || null,
          scheduled_at: slot?.scheduled_at || null,
          is_suspicious: suspicious,
          is_normal_flow: normalFlow,
          deal_id: String(newData.deal_id || oldData.deal_id || '') || null,
          contact_id: String(newData.contact_id || oldData.contact_id || '') || null,
          notes: String(newData.notes || oldData.notes || '') || null,
          r2_observations: String(newData.r2_observations || oldData.r2_observations || '') || null,
          closer_notes: String(newData.closer_notes || oldData.closer_notes || '') || null,
          meeting_link: String(newData.meeting_link || oldData.meeting_link || '') || null,
          video_status: String(newData.video_status || oldData.video_status || '') || null,
          lead_profile: String(newData.lead_profile || oldData.lead_profile || '') || null,
          is_reschedule: Boolean(newData.is_reschedule || oldData.is_reschedule),
          suspension_reason: getSuspensionReason(oldStatus, newStatus, suspicious, normalFlow),
          old_data: oldData,
          new_data: newData,
        };
      });

      // Filter by BU
      let filtered = activeBU && activeBU !== 'incorporador'
        ? entries.filter(e => e.closer_bu === activeBU)
        : entries;

      // Apply filter mode
      if (filterMode === 'suspicious') {
        filtered = filtered.filter(e => e.is_suspicious);
      } else if (filterMode === 'manual') {
        filtered = filtered.filter(e => !e.is_normal_flow);
      }

      return filtered;
    },
  });
}
