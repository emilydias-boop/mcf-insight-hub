import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { R2AuditLog } from '@/types/r2Agenda';

export function useR2AuditHistory(attendeeId: string | null) {
  return useQuery({
    queryKey: ['r2-audit-history', attendeeId],
    queryFn: async () => {
      if (!attendeeId) return [];

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'meeting_slot_attendees')
        .eq('record_id', attendeeId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch user info for each log entry
      const userIds = [...new Set(data.filter(d => d.user_id).map(d => d.user_id))];
      
      let usersMap: Record<string, { name: string; email: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profiles) {
          usersMap = profiles.reduce((acc, p) => {
            acc[p.id] = { name: p.full_name || '', email: p.email || '' };
            return acc;
          }, {} as Record<string, { name: string; email: string }>);
        }
      }

      return data.map(log => ({
        ...log,
        user: log.user_id ? usersMap[log.user_id] : null,
      })) as R2AuditLog[];
    },
    enabled: !!attendeeId,
  });
}

// Get readable diff between old and new data
export function getAuditDiff(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): string[] {
  if (!oldData || !newData) return [];

  const changes: string[] = [];
  const fieldsToTrack = [
    { key: 'status', label: 'Comparecimento' },
    { key: 'partner_name', label: 'Sócio' },
    { key: 'lead_profile', label: 'Perfil' },
    { key: 'video_status', label: 'Vídeo' },
    { key: 'r2_status_id', label: 'Status Final' },
    { key: 'r2_confirmation', label: 'Confirmação R2' },
    { key: 'r2_observations', label: 'Observações' },
    { key: 'meeting_link', label: 'Link' },
  ];

  for (const field of fieldsToTrack) {
    const oldVal = oldData[field.key];
    const newVal = newData[field.key];

    if (oldVal !== newVal) {
      const oldStr = oldVal ? String(oldVal) : '(vazio)';
      const newStr = newVal ? String(newVal) : '(vazio)';
      changes.push(`${field.label}: ${oldStr} → ${newStr}`);
    }
  }

  return changes;
}
