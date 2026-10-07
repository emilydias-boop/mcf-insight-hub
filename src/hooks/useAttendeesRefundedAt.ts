import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Só exibição: lê meeting_slot_attendees.refunded_at para uma lista de attendees.
 * Usado pelas listas do Carrinho R2, cuja fonte (RPC) não traz a coluna.
 */
export function useAttendeesRefundedAt(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id && UUID_RE.test(id)))].sort();
  const { data } = useQuery({
    queryKey: ['attendees-refunded-at', unique],
    enabled: unique.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, string>();
      for (let i = 0; i < unique.length; i += 300) {
        const { data, error } = await supabase
          .from('meeting_slot_attendees')
          .select('id, refunded_at')
          .in('id', unique.slice(i, i + 300))
          .not('refunded_at', 'is', null);
        if (error) throw error;
        for (const r of (data || []) as any[]) if (r.refunded_at) map.set(r.id, r.refunded_at);
      }
      return map;
    },
  });
  return data ?? new Map<string, string>();
}
