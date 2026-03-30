import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CarrinhoConfig } from '@/hooks/useCarrinhoConfig';
import { getCarrinhoMetricBoundaries } from '@/lib/carrinhoWeekBoundaries';

export interface R2CarrinhoKPIs {
  contratosPagos: number;
  r2Agendadas: number;
  r2Realizadas: number;
  foraDoCarrinho: number;
  aprovados: number;
  pendentes: number;
  emAnalise: number;
}

export function useR2CarrinhoKPIs(weekStart: Date, weekEnd: Date, carrinhoConfig?: CarrinhoConfig) {
  return useQuery({
    queryKey: ['r2-carrinho-kpis', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async (): Promise<R2CarrinhoKPIs> => {
      const boundaries = getCarrinhoMetricBoundaries(weekStart, weekEnd, carrinhoConfig);

      // ===== CONTRATOS PAGOS (safra Qui-Qua) =====
      const { data: contratosTx } = await supabase
        .from('hubla_transactions')
        .select('customer_email, hubla_id, source, product_name, installment_number, sale_status, sale_date')
        .eq('product_name', 'A000 - Contrato')
        .in('sale_status', ['completed', 'refunded'])
        .in('source', ['hubla', 'manual', 'make', 'mcfpay', 'kiwify'])
        .gte('sale_date', boundaries.contratos.start.toISOString())
        .lte('sale_date', boundaries.contratos.end.toISOString());

      const validTx = (contratosTx || []).filter(t => {
        if (t.hubla_id?.startsWith('newsale-')) return false;
        if (t.source === 'make' && t.product_name?.toLowerCase() === 'contrato') return false;
        if (t.installment_number && t.installment_number > 1) return false;
        return true;
      });

      // Deduplicate by email, keep first (earliest)
      const emailMap = new Map<string, typeof validTx[0]>();
      for (const tx of validTx) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        if (email && !emailMap.has(email)) emailMap.set(email, tx);
      }
      const uniqueContracts = Array.from(emailMap.values());
      const contratosPagos = uniqueContracts.length;
      const emails = uniqueContracts.map(t => (t.customer_email || '').toLowerCase().trim()).filter(Boolean);

      if (emails.length === 0) {
        // Still need to fetch aprovados from operational window
        const [{ data: statusOpts }, { data: opAprovados }] = await Promise.all([
          supabase.from('r2_status_options').select('id, name').eq('is_active', true),
          supabase
            .from('meeting_slot_attendees')
            .select('id, r2_status_id, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)')
            .eq('meeting_slot.meeting_type', 'r2')
            .gte('meeting_slot.scheduled_at', boundaries.aprovados.start.toISOString())
            .lte('meeting_slot.scheduled_at', boundaries.aprovados.end.toISOString()),
        ]);
        const apvId = (statusOpts || []).find(s =>
          s.name.toLowerCase().includes('aprovado') || s.name.toLowerCase().includes('approved')
        )?.id;
        const apvCount = apvId ? (opAprovados || []).filter((a: any) => a.r2_status_id === apvId).length : 0;

        return { contratosPagos: 0, r2Agendadas: 0, r2Realizadas: 0, foraDoCarrinho: 0, aprovados: apvCount, pendentes: 0, emAnalise: 0 };
      }

      // ===== RESOLVE EMAILS → CONTACTS → R2 ATTENDEES (safra logic) =====
      const { data: contacts } = await supabase
        .from('crm_contacts')
        .select('id, email')
        .in('email', emails);

      const emailToContactId = new Map<string, string>();
      for (const c of contacts || []) {
        if (c.email) emailToContactId.set(c.email.toLowerCase().trim(), c.id);
      }

      const contactIds = Array.from(new Set(Array.from(emailToContactId.values())));

      // Fetch R2 attendees and status options in parallel, plus operational aprovados
      const [r2AttendeesResult, statusOptionsResult, opAprovadosResult] = await Promise.all([
        contactIds.length > 0
          ? supabase
              .from('meeting_slot_attendees')
              .select(`
                id,
                contact_id,
                status,
                r2_status_id,
                meeting_slot:meeting_slots!inner(
                  id,
                  status,
                  scheduled_at,
                  meeting_type
                )
              `)
              .in('contact_id', contactIds)
              .eq('meeting_slot.meeting_type', 'r2')
              .not('meeting_slot.status', 'in', '("cancelled")')
          : Promise.resolve({ data: [] }),
        supabase
          .from('r2_status_options')
          .select('id, name')
          .eq('is_active', true),
        // Aprovados from operational window (Sex-Sex with cutoff)
        supabase
          .from('meeting_slot_attendees')
          .select('id, r2_status_id, meeting_slot:meeting_slots!inner(scheduled_at, meeting_type)')
          .eq('meeting_slot.meeting_type', 'r2')
          .gte('meeting_slot.scheduled_at', boundaries.aprovados.start.toISOString())
          .lte('meeting_slot.scheduled_at', boundaries.aprovados.end.toISOString()),
      ]);

      const statusOptions = statusOptionsResult.data || [];
      const aprovadoStatusId = statusOptions.find(s =>
        s.name.toLowerCase().includes('aprovado') || s.name.toLowerCase().includes('approved')
      )?.id;
      const pendenteStatusId = statusOptions.find(s =>
        s.name.toLowerCase().includes('pendente') || s.name.toLowerCase().includes('pending')
      )?.id;
      const emAnaliseStatusId = statusOptions.find(s =>
        s.name.toLowerCase().includes('análise') || s.name.toLowerCase().includes('analise')
      )?.id;
      const foraDoCarrinhoNames = ['reembolso', 'desistente', 'reprovado', 'próxima semana', 'cancelado'];
      const foraDoCarrinhoStatusIds = statusOptions
        .filter(s => foraDoCarrinhoNames.some(name => s.name.toLowerCase().includes(name)))
        .map(s => s.id);

      // Count aprovados from operational window
      const aprovados = aprovadoStatusId
        ? (opAprovadosResult.data || []).filter((a: any) => a.r2_status_id === aprovadoStatusId).length
        : 0;

      if (contactIds.length === 0) {
        return { contratosPagos, r2Agendadas: 0, r2Realizadas: 0, foraDoCarrinho: 0, aprovados, pendentes: 0, emAnalise: 0 };
      }

      // Build map: contactId → all R2 attendees
      const contactR2Map = new Map<string, Array<{
        id: string;
        status: string;
        r2_status_id: string | null;
        scheduled_at: string;
        slotStatus: string;
      }>>();

      for (const att of r2AttendeesResult.data || []) {
        const cid = (att as any).contact_id;
        const slot = att.meeting_slot as any;
        if (!cid || !slot?.scheduled_at) continue;
        if (!contactR2Map.has(cid)) contactR2Map.set(cid, []);
        contactR2Map.get(cid)!.push({
          id: att.id,
          status: att.status,
          r2_status_id: att.r2_status_id,
          scheduled_at: slot.scheduled_at,
          slotStatus: slot.status || '',
        });
      }

      // For each contract, pick first R2 after sale_date
      let r2Agendadas = 0;
      let r2Realizadas = 0;
      let foraDoCarrinho = 0;
      let pendentes = 0;
      let emAnalise = 0;

      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const contactId = emailToContactId.get(email);
        if (!contactId) continue;

        const allR2s = contactR2Map.get(contactId) || [];
        const saleDateMs = new Date(tx.sale_date).getTime();

        // Filter R2s after contract and sort ascending
        const validR2s = allR2s
          .filter(r => new Date(r.scheduled_at).getTime() > saleDateMs)
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

        if (validR2s.length === 0) continue;

        const firstR2 = validR2s[0];

        // Count as agendada
        if (firstR2.status !== 'rescheduled') {
          r2Agendadas++;
        }

        // Count as realizada
        if (firstR2.status === 'completed' || firstR2.status === 'presente' || firstR2.slotStatus === 'completed') {
          r2Realizadas++;
        }

        // Status counts (except aprovados — handled by operational window)
        if (firstR2.r2_status_id === pendenteStatusId) pendentes++;
        else if (firstR2.r2_status_id === emAnaliseStatusId) emAnalise++;
        else if (firstR2.r2_status_id && foraDoCarrinhoStatusIds.includes(firstR2.r2_status_id)) foraDoCarrinho++;
      }

      return {
        contratosPagos,
        r2Agendadas,
        r2Realizadas,
        foraDoCarrinho,
        aprovados,
        pendentes,
        emAnalise,
      };
    },
  });
}
