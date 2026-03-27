import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { getUFFromPhone } from '@/lib/dddToUF';

export interface CarrinhoAnalysisKPIs {
  carrinhoInicio: number;
  novosContratos: number;
  totalElegivel: number;
  comunicados: number;
  r2Agendadas: number;
  r2Realizadas: number;
  perdidos: number;
  taxaAproveitamento: number;
  taxaPerda: number;
}

export interface FunnelStep {
  label: string;
  count: number;
  pct: number;
}

export interface MotivoPerda {
  motivo: string;
  count: number;
  pct: number;
  tipo: 'legitima' | 'operacional';
}

export interface StateAnalysis {
  uf: string;
  contratos: number;
  agendados: number;
  realizados: number;
  perdidos: number;
  taxaPerda: number;
}

export interface LeadDetalhado {
  nome: string;
  telefone: string;
  estado: string;
  dataCompra: string;
  produto: string;
  statusAtual: string;
  r2Agendada: boolean;
  r2Realizada: boolean;
  motivoPerda: string;
  tipoPerda: 'legitima' | 'operacional';
  responsavel: string;
  ultimaInteracao: string;
  diasSemAndamento: number;
}

export interface CarrinhoAnalysisData {
  kpis: CarrinhoAnalysisKPIs;
  funnelSteps: FunnelStep[];
  motivosPerda: MotivoPerda[];
  analysisByState: StateAnalysis[];
  leadsDetalhados: LeadDetalhado[];
}

function classifyLoss(
  attendee: any | null,
  hasRefund: boolean,
  r2StatusName: string | null,
): { motivo: string; tipo: 'legitima' | 'operacional' } {
  if (hasRefund) return { motivo: 'Reembolso', tipo: 'legitima' };

  if (!attendee) return { motivo: 'Sem cadastro no carrinho', tipo: 'operacional' };

  const status = attendee.status?.toLowerCase() || '';
  const carrStatus = attendee.carrinho_status?.toLowerCase() || '';

  if (r2StatusName) {
    const name = r2StatusName.toLowerCase();
    if (name.includes('desist')) return { motivo: 'Desistente', tipo: 'legitima' };
    if (name.includes('reprov')) return { motivo: 'Reprovado', tipo: 'legitima' };
    if (name.includes('cancel')) return { motivo: 'Cancelado', tipo: 'legitima' };
  }

  if (status === 'no_show') return { motivo: 'No-Show na R2', tipo: 'operacional' };
  if (status === 'sem_sucesso' || carrStatus === 'sem_sucesso') return { motivo: 'Sem sucesso / Sem contato', tipo: 'operacional' };
  if (status === 'cancelled' || status === 'canceled') return { motivo: 'Cancelado', tipo: 'legitima' };

  if (attendee.meeting_slot_id && !attendee.confirmed_at) return { motivo: 'R2 agendada mas não realizada', tipo: 'operacional' };

  if (!attendee.meeting_slot_id && attendee.deal_id) return { motivo: 'Não agendado', tipo: 'operacional' };
  if (carrStatus === 'pendente' || !carrStatus) return { motivo: 'Sem comunicação', tipo: 'operacional' };

  return { motivo: 'Outros', tipo: 'operacional' };
}

export function useCarrinhoAnalysisReport(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: ['carrinho-analysis', startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!startDate && !!endDate,
    queryFn: async (): Promise<CarrinhoAnalysisData> => {
      if (!startDate || !endDate) throw new Error('Datas não definidas');

      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch paid contracts (exclude refunds/chargebacks)
      const { data: transactions } = await supabase
        .from('hubla_transactions')
        .select('id, customer_name, customer_email, customer_phone, product_name, product_code, product_category, sale_date, net_value, event_type, sale_status, linked_attendee_id')
        .in('product_category', ['incorporador', 'contrato'])
        .gte('sale_date', startStr)
        .lte('sale_date', endStr + 'T23:59:59')
        .order('sale_date', { ascending: true });

      // Filter out refunds/chargebacks on the client side
      const validTransactions = (transactions || []).filter(t => {
        const evType = (t.event_type || '').toLowerCase();
        return evType !== 'refund' && evType !== 'chargeback';
      });

      const emailMap = new Map<string, typeof validTransactions[0]>();
      for (const t of validTransactions) {
        const email = (t.customer_email || '').toLowerCase().trim();
        if (email && !emailMap.has(email)) {
          emailMap.set(email, t);
        }
      }
      const uniqueContracts = Array.from(emailMap.values());

      const emails = uniqueContracts.map(t => (t.customer_email || '').toLowerCase().trim()).filter(Boolean);
      
      let refundEmails = new Set<string>();
      if (emails.length > 0) {
        const { data: refunds } = await supabase
          .from('hubla_transactions')
          .select('customer_email')
          .in('customer_email', emails)
          .in('event_type', ['refund', 'REFUND', 'chargeback', 'CHARGEBACK']);
        
        refundEmails = new Set((refunds || []).map(r => (r.customer_email || '').toLowerCase().trim()));
      }

      const attendeeIds = uniqueContracts
        .map(t => t.linked_attendee_id)
        .filter(Boolean) as string[];

      let attendeeMap = new Map<string, any>();
      
      if (attendeeIds.length > 0) {
        const { data: attendees } = await supabase
          .from('meeting_slot_attendees')
          .select(`
            id, attendee_name, attendee_phone, status, carrinho_status,
            contact_id, deal_id, meeting_slot_id, r2_status_id,
            confirmed_at, booked_at, booked_by, updated_at,
            meeting_slot:meeting_slots(scheduled_at, status, closer_id, closer:closers(name))
          `)
          .in('id', attendeeIds);

        for (const a of attendees || []) {
          attendeeMap.set(a.id, a);
        }
      }

      if (emails.length > 0) {
        const { data: contactsWithEmail } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .in('email', emails);

        const contactEmailMap = new Map<string, string>();
        for (const c of contactsWithEmail || []) {
          if (c.email) contactEmailMap.set(c.email.toLowerCase().trim(), c.id);
        }

        const contactIds = Array.from(contactEmailMap.values());
        if (contactIds.length > 0) {
          const { data: attendeesByContact } = await supabase
            .from('meeting_slot_attendees')
            .select(`
              id, attendee_name, attendee_phone, status, carrinho_status,
              contact_id, deal_id, meeting_slot_id, r2_status_id,
              confirmed_at, booked_at, booked_by, updated_at,
              meeting_slot:meeting_slots(scheduled_at, status, closer_id, closer:closers(name))
            `)
            .in('contact_id', contactIds);

          const contactIdToEmail = new Map<string, string>();
          for (const [email, cid] of contactEmailMap) {
            contactIdToEmail.set(cid, email);
          }

          for (const a of attendeesByContact || []) {
            if (a.contact_id) {
              const email = contactIdToEmail.get(a.contact_id);
              if (email) {
                const tx = uniqueContracts.find(t => (t.customer_email || '').toLowerCase().trim() === email);
                if (tx && !tx.linked_attendee_id && !attendeeMap.has(a.id)) {
                  attendeeMap.set(`email:${email}`, a);
                }
              }
            }
          }
        }
      }

      const { data: r2StatusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .eq('is_active', true);

      const statusNameMap = new Map<string, string>();
      for (const s of r2StatusOptions || []) {
        statusNameMap.set(s.id, s.name);
      }

      const leadsDetalhados: LeadDetalhado[] = [];
      let comunicados = 0;
      let r2Agendadas = 0;
      let r2Realizadas = 0;
      const motivosCount = new Map<string, { count: number; tipo: 'legitima' | 'operacional' }>();
      const stateData = new Map<string, { contratos: number; agendados: number; realizados: number; perdidos: number }>();

      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const hasRefund = refundEmails.has(email);

        let attendee = tx.linked_attendee_id ? attendeeMap.get(tx.linked_attendee_id) : null;
        if (!attendee) attendee = attendeeMap.get(`email:${email}`);

        const r2StatusName = attendee?.r2_status_id ? statusNameMap.get(attendee.r2_status_id) || null : null;

        const slotStatus = attendee?.meeting_slot?.status?.toLowerCase() || '';
        const attendeeStatus = attendee?.status?.toLowerCase() || '';
        const isR2Agendada = !!attendee?.meeting_slot_id;
        const isR2Realizada = isR2Agendada && (
          attendeeStatus === 'completed' || 
          attendeeStatus === 'presente' ||
          !!attendee?.confirmed_at ||
          slotStatus === 'completed'
        );

        const isComunicado = !!attendee && (
          attendee.carrinho_status === 'comunicado' ||
          attendee.carrinho_status === 'agendado' ||
          !!attendee.booked_at ||
          isR2Agendada
        );

        if (isComunicado) comunicados++;
        if (isR2Agendada) r2Agendadas++;
        if (isR2Realizada) r2Realizadas++;

        const uf = getUFFromPhone(tx.customer_phone || attendee?.attendee_phone);

        if (!stateData.has(uf)) stateData.set(uf, { contratos: 0, agendados: 0, realizados: 0, perdidos: 0 });
        const sd = stateData.get(uf)!;
        sd.contratos++;
        if (isR2Agendada) sd.agendados++;
        if (isR2Realizada) sd.realizados++;

        if (!isR2Realizada) {
          const loss = classifyLoss(attendee, hasRefund, r2StatusName);
          sd.perdidos++;

          const existing = motivosCount.get(loss.motivo);
          if (existing) existing.count++;
          else motivosCount.set(loss.motivo, { count: 1, tipo: loss.tipo });

          const closerName = (attendee?.meeting_slot as any)?.closer?.name || '';
          const lastInteraction = attendee?.updated_at || tx.sale_date;
          const dias = differenceInDays(new Date(), new Date(lastInteraction));

          leadsDetalhados.push({
            nome: tx.customer_name || 'Sem nome',
            telefone: tx.customer_phone || attendee?.attendee_phone || '',
            estado: uf,
            dataCompra: tx.sale_date,
            produto: tx.product_name || tx.product_code || '',
            statusAtual: attendee?.carrinho_status || attendee?.status || 'Sem status',
            r2Agendada: isR2Agendada,
            r2Realizada: isR2Realizada,
            motivoPerda: loss.motivo,
            tipoPerda: loss.tipo,
            responsavel: closerName,
            ultimaInteracao: lastInteraction,
            diasSemAndamento: dias,
          });
        }
      }

      const totalElegivel = uniqueContracts.length;
      const perdidos = totalElegivel - r2Realizadas;

      const kpis: CarrinhoAnalysisKPIs = {
        carrinhoInicio: 0,
        novosContratos: totalElegivel,
        totalElegivel,
        comunicados,
        r2Agendadas,
        r2Realizadas,
        perdidos,
        taxaAproveitamento: totalElegivel > 0 ? (r2Realizadas / totalElegivel) * 100 : 0,
        taxaPerda: totalElegivel > 0 ? (perdidos / totalElegivel) * 100 : 0,
      };

      const funnelSteps: FunnelStep[] = [
        { label: 'Contratos no período', count: totalElegivel, pct: 100 },
        { label: 'Comunicados', count: comunicados, pct: totalElegivel > 0 ? (comunicados / totalElegivel) * 100 : 0 },
        { label: 'R2 Agendadas', count: r2Agendadas, pct: totalElegivel > 0 ? (r2Agendadas / totalElegivel) * 100 : 0 },
        { label: 'R2 Realizadas', count: r2Realizadas, pct: totalElegivel > 0 ? (r2Realizadas / totalElegivel) * 100 : 0 },
      ];

      const totalPerdidos = leadsDetalhados.length || 1;
      const motivosPerda: MotivoPerda[] = Array.from(motivosCount.entries())
        .map(([motivo, { count, tipo }]) => ({
          motivo,
          count,
          pct: (count / totalPerdidos) * 100,
          tipo,
        }))
        .sort((a, b) => b.count - a.count);

      const analysisByState: StateAnalysis[] = Array.from(stateData.entries())
        .map(([uf, d]) => ({
          uf,
          contratos: d.contratos,
          agendados: d.agendados,
          realizados: d.realizados,
          perdidos: d.perdidos,
          taxaPerda: d.contratos > 0 ? (d.perdidos / d.contratos) * 100 : 0,
        }))
        .sort((a, b) => b.contratos - a.contratos);

      return { kpis, funnelSteps, motivosPerda, analysisByState, leadsDetalhados };
    },
  });
}
