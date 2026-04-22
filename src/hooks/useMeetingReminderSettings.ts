import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MeetingReminderSettings {
  id: number;
  is_active: boolean;
  enabled_offsets: string[];
  apply_to_r1: boolean;
  apply_to_r2: boolean;
  fallback_meeting_link: string | null;
  ac_list_id: number | null;
  ac_setup_confirmed: boolean;
  ac_setup_checklist: Record<string, boolean>;
  updated_at: string;
}

export function useMeetingReminderSettings() {
  return useQuery({
    queryKey: ['meeting-reminder-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_reminder_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data as MeetingReminderSettings | null;
    },
  });
}

export function useUpdateMeetingReminderSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<MeetingReminderSettings>) => {
      const { data, error } = await supabase
        .from('meeting_reminder_settings')
        .update(patch)
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting-reminder-settings'] });
      toast.success('Configurações atualizadas');
    },
    onError: (e: any) => toast.error('Erro ao salvar', { description: e.message }),
  });
}

export function useRunRemindersCron() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('meeting-reminders-cron', {
        body: { manual: true, triggered_at: new Date().toISOString() },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const sent = data?.sent ?? 0;
      const skipped = data?.skipped ?? 0;
      const failed = data?.failed ?? 0;
      toast.success('Cron executado', {
        description: `Enviados: ${sent} · Pulados: ${skipped} · Falhas: ${failed}`,
      });
    },
    onError: (e: any) => toast.error('Erro ao executar cron', { description: e.message }),
  });
}
