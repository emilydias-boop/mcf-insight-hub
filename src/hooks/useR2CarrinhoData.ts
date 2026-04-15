import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

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

async function fetchAttendeesFromQuery(
  meetingType: string,
  startISO: string,
  endISO: string,
  statusMap: Record<string, string>,
  filter?: 'agendadas' | 'no_show' | 'realizadas' | 'aprovados',
  aprovadoStatusId?: string,
  weekStartStr?: string,
): Promise<R2CarrinhoAttendee[]> {
  const { data } = await supabase
    .from('meeting_slot_attendees')
    .select(`
      id,
      attendee_name,
      attendee_phone,
      status,
      r2_status_id,
      carrinho_status,
      carrinho_updated_at,
      carrinho_week_start,
      deal_id,
      contact_id,
      partner_name,
      contract_paid_at,
      deal:crm_deals(
        id,
        name,
        contact:crm_contacts(
          phone,
          email
        )
      ),
      meeting_slot:meeting_slots!inner(
        id,
        status,
        scheduled_at,
        meeting_type,
        closer:closers!meeting_slots_closer_id_fkey(
          id,
          name,
          color
        )
      )
    `)
    .eq('meeting_slot.meeting_type', meetingType)
    .gte('meeting_slot.scheduled_at', startISO)
    .lte('meeting_slot.scheduled_at', endISO);

  let filteredAttendees = data || [];
  if (filter === 'aprovados' && aprovadoStatusId) {
    filteredAttendees = filteredAttendees.filter((att: any) => att.r2_status_id === aprovadoStatusId);
  }

  const attendees: R2CarrinhoAttendee[] = [];
  for (const att of filteredAttendees) {
    const slot = (att as any).meeting_slot;
    const closerData = slot?.closer;

    // If this attendee is "encaixado" in a different week, skip it
    const attWeekStart = (att as any).carrinho_week_start;
    if (attWeekStart && weekStartStr && attWeekStart !== weekStartStr) continue;

    if (filter === 'agendadas') {
      if (slot.status === 'cancelled' || slot.status === 'rescheduled') continue;
    } else if (filter === 'no_show') {
      if (slot.status !== 'no_show') continue;
    } else if (filter === 'realizadas') {
      if (slot.status !== 'completed') continue;
    }

    const isEncaixado = !!(attWeekStart && weekStartStr && attWeekStart === weekStartStr);

    attendees.push({
      id: att.id,
      attendee_name: att.attendee_name,
      attendee_phone: att.attendee_phone,
      status: att.status,
      r2_status_id: att.r2_status_id,
      r2_status_name: att.r2_status_id ? statusMap[att.r2_status_id] : null,
      carrinho_status: (att as any).carrinho_status,
      carrinho_updated_at: (att as any).carrinho_updated_at,
      deal_id: att.deal_id,
      meeting_id: slot.id,
      meeting_status: slot.status,
      scheduled_at: slot.scheduled_at,
      closer_id: closerData?.id || null,
      closer_name: closerData?.name || null,
      closer_color: closerData?.color || null,
      deal_name: (att as any).deal?.name || null,
      contact_phone: (att as any).deal?.contact?.phone || null,
      contact_email: (att as any).deal?.contact?.email || null,
      partner_name: (att as any).partner_name,
      r1_date: null,
      r1_closer_name: null,
      contract_paid_at: (att as any).contract_paid_at,
      is_encaixado: isEncaixado,
    });
  }
  return attendees;
}

async function fetchEncaixadosForWeek(
  weekStartStr: string,
  statusMap: Record<string, string>,
  filter?: 'agendadas' | 'no_show' | 'realizadas' | 'aprovados',
  aprovadoStatusId?: string,
): Promise<R2CarrinhoAttendee[]> {
  // Use rpc-style workaround: query with filter on carrinho_week_start via raw
  // Since the column isn't in generated types yet, we cast the query
  const query = supabase
    .from('meeting_slot_attendees')
    .select(`
      id,
      attendee_name,
      attendee_phone,
      status,
      r2_status_id,
      carrinho_status,
      carrinho_updated_at,
      deal_id,
      contact_id,
      partner_name,
      contract_paid_at,
      deal:crm_deals(
        id,
        name,
        contact:crm_contacts(
          phone,
          email
        )
      ),
      meeting_slot:meeting_slots!inner(
        id,
        status,
        scheduled_at,
        meeting_type,
        closer:closers!meeting_slots_closer_id_fkey(
          id,
          name,
          color
        )
      )
    `)
    .eq('meeting_slot.meeting_type', 'r2');

  // Apply filter on the new column
  (query as any).eq('carrinho_week_start', weekStartStr);

  const { data } = await query;
  let filteredAttendees = data || [];
  if (filter === 'aprovados' && aprovadoStatusId) {
    filteredAttendees = filteredAttendees.filter((att: any) => att.r2_status_id === aprovadoStatusId);
  }

  const attendees: R2CarrinhoAttendee[] = [];
  for (const att of filteredAttendees) {
    const slot = (att as any).meeting_slot;
    const closerData = slot?.closer;

    if (filter === 'agendadas') {
      if (slot.status === 'cancelled' || slot.status === 'rescheduled') continue;
    } else if (filter === 'no_show') {
      if (slot.status !== 'no_show') continue;
    } else if (filter === 'realizadas') {
      if (slot.status !== 'completed') continue;
    }

    attendees.push({
      id: att.id,
      attendee_name: att.attendee_name,
      attendee_phone: att.attendee_phone,
      status: att.status,
      r2_status_id: att.r2_status_id,
      r2_status_name: att.r2_status_id ? statusMap[att.r2_status_id] : null,
      carrinho_status: (att as any).carrinho_status,
      carrinho_updated_at: (att as any).carrinho_updated_at,
      deal_id: att.deal_id,
      meeting_id: slot.id,
      meeting_status: slot.status,
      scheduled_at: slot.scheduled_at,
      closer_id: closerData?.id || null,
      closer_name: closerData?.name || null,
      closer_color: closerData?.color || null,
      deal_name: (att as any).deal?.name || null,
      contact_phone: (att as any).deal?.contact?.phone || null,
      contact_email: (att as any).deal?.contact?.email || null,
      partner_name: (att as any).partner_name,
      r1_date: null,
      r1_closer_name: null,
      contract_paid_at: (att as any).contract_paid_at,
      is_encaixado: true,
    });
  }
  return attendees;
}

export function useR2CarrinhoData(weekStart: Date, weekEnd: Date, filter?: 'agendadas' | 'no_show' | 'realizadas' | 'aprovados', carrinhoConfig?: CarrinhoConfig, previousConfig?: CarrinhoConfig) {
  return useQuery({
    queryKey: ['r2-carrinho-data', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), filter, carrinhoConfig?.carrinhos?.[0]?.horario_corte, previousConfig?.carrinhos?.[0]?.horario_corte],
    queryFn: async (): Promise<R2CarrinhoAttendee[]> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig, previousConfig);
      const useBoundary = filter === 'aprovados' ? boundaries.aprovados : boundaries.r2Meetings;

      const { data: statusOptionsData } = await supabase.from('r2_status_options').select('id, name');
      const statusOptions = statusOptionsData || [];
      const statusMap = statusOptions.reduce((acc, s) => {
        acc[s.id] = s.name;
        return acc;
      }, {} as Record<string, string>);

      const aprovadoStatusId = statusOptions.find(s =>
        s.name.toLowerCase().includes('aprovado') || s.name.toLowerCase().includes('approved')
      )?.id;

      if (filter === 'aprovados' && !aprovadoStatusId) return [];

      const weekStartStr = format(weekStart, 'yyyy-MM-dd');

      // Fetch both: regular boundary attendees + encaixados for this week
      const [regularAttendees, encaixados] = await Promise.all([
        fetchAttendeesFromQuery('r2', useBoundary.start.toISOString(), useBoundary.end.toISOString(), statusMap, filter, aprovadoStatusId, weekStartStr),
        fetchEncaixadosForWeek(weekStartStr, statusMap, filter, aprovadoStatusId),
      ]);

      // Merge, avoiding duplicates by id
      const idSet = new Set(regularAttendees.map(a => a.id));
      const merged = [...regularAttendees];
      for (const enc of encaixados) {
        if (!idSet.has(enc.id)) {
          merged.push(enc);
          idSet.add(enc.id);
        }
      }

      // Fetch R1 data
      const dealIds = [...new Set(merged.map(a => a.deal_id).filter(Boolean) as string[])];
      if (dealIds.length > 0) {
        const { data: r1Meetings } = await supabase
          .from('meeting_slots')
          .select(`
            scheduled_at,
            closer:closers!meeting_slots_closer_id_fkey(name),
            meeting_slot_attendees!inner(deal_id, contract_paid_at)
          `)
          .eq('meeting_type', 'r1')
          .in('meeting_slot_attendees.deal_id', dealIds);

        const r1Map = new Map<string, { date: string; closer_name: string | null; contract_paid_at: string | null }>();
        r1Meetings?.forEach(r1 => {
          const r1Attendees = r1.meeting_slot_attendees as Array<{ deal_id: string | null; contract_paid_at: string | null }>;
          const r1Closer = r1.closer as { name: string } | null;
          r1Attendees.forEach(rAtt => {
            if (rAtt.deal_id && !r1Map.has(rAtt.deal_id)) {
              r1Map.set(rAtt.deal_id, { date: r1.scheduled_at, closer_name: r1Closer?.name || null, contract_paid_at: rAtt.contract_paid_at || null });
            }
          });
        });

        for (const att of merged) {
          if (att.deal_id && r1Map.has(att.deal_id)) {
            const r1Data = r1Map.get(att.deal_id)!;
            att.r1_date = r1Data.date;
            att.r1_closer_name = r1Data.closer_name;
            att.contract_paid_at = att.contract_paid_at || r1Data.contract_paid_at;
          }
        }
      }

      // Fallback: buscar contract_paid_at via hubla_transactions para leads sem data
      const missingContractEmails = merged
        .filter(a => !a.contract_paid_at && a.contact_email)
        .map(a => a.contact_email!.toLowerCase().trim());

      if (missingContractEmails.length > 0) {
        const uniqueEmails = [...new Set(missingContractEmails)];
        const { data: txs } = await supabase
          .from('hubla_transactions')
          .select('customer_email, sale_date')
          .eq('product_name', 'A000 - Contrato')
          .in('sale_status', ['completed', 'refunded'])
          .in('customer_email', uniqueEmails)
          .order('sale_date', { ascending: false });

        const emailToSaleDate = new Map<string, string>();
        for (const tx of txs || []) {
          const email = (tx.customer_email || '').toLowerCase().trim();
          if (email && !emailToSaleDate.has(email)) {
            emailToSaleDate.set(email, tx.sale_date!);
          }
        }

        for (const att of merged) {
          if (!att.contract_paid_at && att.contact_email) {
            const saleDate = emailToSaleDate.get(att.contact_email.toLowerCase().trim());
            if (saleDate) att.contract_paid_at = saleDate;
          }
        }
      }

      merged.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      return merged;
    },
  });
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
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-data'] });
      queryClient.invalidateQueries({ queryKey: ['r2-carrinho-kpis'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}
