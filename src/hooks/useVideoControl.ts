import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface VideoControlRecord {
  id: string;
  attendee_id: string;
  video_sent: boolean;
  sent_at: string | null;
  sent_by: string | null;
  notes: string | null;
}

export const useVideoControlBatch = (attendeeIds: string[]) => {
  return useQuery({
    queryKey: ['video-control-batch', attendeeIds],
    queryFn: async (): Promise<Record<string, VideoControlRecord>> => {
      if (attendeeIds.length === 0) return {};
      
      const { data, error } = await (supabase as any)
        .from('contract_video_control')
        .select('*')
        .in('attendee_id', attendeeIds);
      
      if (error) throw error;
      
      const map: Record<string, VideoControlRecord> = {};
      (data || []).forEach((r: VideoControlRecord) => {
        map[r.attendee_id] = r;
      });
      return map;
    },
    enabled: attendeeIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });
};

export const useToggleVideoSent = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ attendeeId, videoSent, notes }: { attendeeId: string; videoSent: boolean; notes?: string }) => {
      const payload: any = {
        attendee_id: attendeeId,
        video_sent: videoSent,
        sent_at: videoSent ? new Date().toISOString() : null,
        sent_by: videoSent ? user?.id : null,
        notes: notes || null,
      };
      
      const { error } = await (supabase as any)
        .from('contract_video_control')
        .upsert(payload, { onConflict: 'attendee_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-control-batch'] });
    },
  });
};
