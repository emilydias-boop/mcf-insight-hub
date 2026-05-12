import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { R2SpecialMarking } from '@/types/r2SpecialMarking';

const QK = ['r2-special-markings'] as const;

export function useR2SpecialMarkings() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<R2SpecialMarking[]> => {
      const { data, error } = await supabase
        .from('r2_special_markings' as any)
        .select('*, employee:employees!closer_r1_employee_id(nome_completo)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        closer_r1_employee_id: r.closer_r1_employee_id,
        closer_r1_name: r.employee?.nome_completo || null,
        required_channel: r.required_channel,
        require_contract_paid: r.require_contract_paid,
        bg_color: r.bg_color,
        text_color: r.text_color,
        icon: r.icon,
        badge_label: r.badge_label,
        active: r.active,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    },
    staleTime: 60_000,
  });
}

export function useActiveR2SpecialMarkings() {
  const q = useR2SpecialMarkings();
  return useMemo(() => ({
    ...q,
    data: (q.data || []).filter(r => r.active),
  }), [q]);
}

type UpsertPayload = Partial<R2SpecialMarking> & {
  name: string;
  closer_r1_employee_id: string;
  badge_label: string;
};

export function useUpsertR2SpecialMarking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertPayload & { id?: string }) => {
      const { id, closer_r1_name, ...rest } = payload as any;
      const row = {
        name: rest.name,
        closer_r1_employee_id: rest.closer_r1_employee_id,
        required_channel: rest.required_channel ?? null,
        require_contract_paid: rest.require_contract_paid ?? true,
        bg_color: rest.bg_color || '#7c3aed',
        text_color: rest.text_color || '#ffffff',
        icon: rest.icon || '📋',
        badge_label: rest.badge_label,
        active: rest.active ?? true,
      };
      if (id) {
        const { error } = await supabase
          .from('r2_special_markings' as any)
          .update(row)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('r2_special_markings' as any)
          .insert(row as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteR2SpecialMarking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('r2_special_markings' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}