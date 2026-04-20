import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { useCarrinhoUnifiedData, isAprovado, CarrinhoLeadRow } from '@/hooks/useCarrinhoUnifiedData';
import { useMemo } from 'react';

export interface R2CarrinhoAttendee {
  id: string;
  attendee_name: string | null;
  attendee_phone: string | null;
  status: string;
  r2_status_id: string | null;
  r2_status_name: string | null;
  carrinho_status: string | null;
  carrinho_updated_at: string | null;
  deal_id: string | null;
  meeting_id: string;
  meeting_status: string;
  scheduled_at: string;
  display_scheduled_at: string;
  closer_id: string | null;
  closer_name: string | null;
  closer_color: string | null;
  deal_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  partner_name: string | null;
  r1_date: string | null;
  r1_closer_name: string | null;
  contract_paid_at: string | null;
  is_encaixado?: boolean;
}

function toAttendee(row: CarrinhoLeadRow): R2CarrinhoAttendee {
  return {
    id: row.attendee_id,
    attendee_name: row.attendee_name,
    attendee_phone: row.attendee_phone,
    status: row.attendee_status || '',
    r2_status_id: row.r2_status_id,
    r2_status_name: row.r2_status_name,
    carrinho_status: row.carrinho_status,
    carrinho_updated_at: row.carrinho_updated_at,
    deal_id: row.deal_id,
    meeting_id: row.meeting_slot_id || '',
    meeting_status: row.meeting_status || '',
    scheduled_at: row.scheduled_at || '',
    display_scheduled_at: row.scheduled_at || '',
    closer_id: row.r2_closer_id,
    closer_name: row.r2_closer_name,
    closer_color: row.r2_closer_color,
    deal_name: row.deal_name,
    contact_phone: row.contact_phone,
    contact_email: row.contact_email,
    partner_name: row.partner_name,
    r1_date: row.r1_scheduled_at,
    r1_closer_name: row.r1_closer_name,
    contract_paid_at: row.contract_paid_at || row.r1_contract_paid_at,
    is_encaixado: row.is_encaixado,
  };
}

export function useR2CarrinhoData(
  weekStart: Date,
  weekEnd: Date,
  filter?: 'agendadas' | 'no_show' | 'realizadas' | 'aprovados' | 'aprovados_proxima_safra',
  carrinhoConfig?: CarrinhoConfig,
  previousConfig?: CarrinhoConfig
) {
  const { data: unifiedData, isLoading } = useCarrinhoUnifiedData(weekStart, weekEnd, carrinhoConfig, previousConfig);

  const data = useMemo((): R2CarrinhoAttendee[] => {
    if (!unifiedData) return [];

    let filtered = unifiedData;

    if (filter === 'aprovados') {
      filtered = filtered.filter(r => isAprovado(r) && r.dentro_corte === true);
    } else if (filter === 'aprovados_proxima_safra') {
      filtered = filtered.filter(r => isAprovado(r) && r.dentro_corte === false);
    } else if (filter === 'agendadas') {
      filtered = filtered.filter(r => r.meeting_status !== 'cancelled' && r.meeting_status !== 'rescheduled');
    } else if (filter === 'no_show') {
      filtered = filtered.filter(r => r.meeting_status === 'no_show');
    } else if (filter === 'realizadas') {
      filtered = filtered.filter(r => r.meeting_status === 'completed');
    }

    const attendees = filtered.map(toAttendee);
    attendees.sort((a, b) => new Date(a.display_scheduled_at).getTime() - new Date(b.display_scheduled_at).getTime());
    return attendees;
  }, [unifiedData, filter]);

  return { data, isLoading };
}


export function useUpdateCarrinhoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attendeeId,
      status
    }: {
      attendeeId: string;
      status: 'vai_comprar' | 'comprou' | 'nao_comprou' | 'negociando' | 'quer_desistir' | null;
    }) => {
      const { error } = await supabase
        .from('meeting_slot_attendees')
        .update({
          carrinho_status: status,
          carrinho_updated_at: new Date().toISOString(),
        })
        .eq('id', attendeeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrinho-unified-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}
