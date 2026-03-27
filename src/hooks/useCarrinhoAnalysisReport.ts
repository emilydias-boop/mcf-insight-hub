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
  isOutside: boolean;
}

export interface CarrinhoAnalysisData {
  kpis: CarrinhoAnalysisKPIs;
  funnelSteps: FunnelStep[];
  motivosPerda: MotivoPerda[];
  analysisByState: StateAnalysis[];
  leadsDetalhados: LeadDetalhado[];
}

function normalizePhoneSuffix(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
}

function classifyLoss(
  attendee: any | null,
  hasRefund: boolean,
  r2StatusName: string | null,
  contactExistsInCRM: boolean,
): { motivo: string; tipo: 'legitima' | 'operacional' } {
  if (hasRefund) return { motivo: 'Reembolso', tipo: 'legitima' };

  if (!attendee) {
    if (contactExistsInCRM) {
      return { motivo: 'Contato existe mas sem R2', tipo: 'operacional' };
    }
    return { motivo: 'Sem contato no CRM', tipo: 'operacional' };
  }

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

const ATTENDEE_SELECT = `
  id, attendee_name, attendee_phone, status, carrinho_status,
  contact_id, deal_id, meeting_slot_id, r2_status_id,
  confirmed_at, booked_at, booked_by, updated_at,
  meeting_slot:meeting_slots(scheduled_at, status, closer_id, meeting_type, closer:closers(name))
`;

export function useCarrinhoAnalysisReport(startDate: Date | null, endDate: Date | null) {
  return useQuery({
    queryKey: ['carrinho-analysis', startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!startDate && !!endDate,
    queryFn: async (): Promise<CarrinhoAnalysisData> => {
      if (!startDate || !endDate) throw new Error('Datas não definidas');

      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // 1. Fetch transactions (incorporador/contrato), exclude refunds and recurrences
      const { data: transactions } = await supabase
        .from('hubla_transactions')
        .select('id, customer_name, customer_email, customer_phone, product_name, product_code, product_category, sale_date, net_value, event_type, sale_status, linked_attendee_id, installment_number')
        .in('product_category', ['incorporador', 'contrato'])
        .gte('sale_date', startStr)
        .lte('sale_date', endStr + 'T23:59:59')
        .order('sale_date', { ascending: true });

      const validTransactions = (transactions || []).filter(t => {
        const evType = (t.event_type || '').toLowerCase();
        if (evType === 'refund' || evType === 'chargeback') return false;
        // Filter out recurrences — only keep first installment
        const installment = t.installment_number;
        if (installment !== null && installment !== undefined && installment > 1) return false;
        return true;
      });

      // Deduplicate by email
      const emailMap = new Map<string, typeof validTransactions[0]>();
      for (const t of validTransactions) {
        const email = (t.customer_email || '').toLowerCase().trim();
        if (email && !emailMap.has(email)) {
          emailMap.set(email, t);
        }
      }
      const uniqueContracts = Array.from(emailMap.values());

      const emails = uniqueContracts.map(t => (t.customer_email || '').toLowerCase().trim()).filter(Boolean);

      // 2. Find refund emails
      let refundEmails = new Set<string>();
      if (emails.length > 0) {
        const { data: refunds } = await supabase
          .from('hubla_transactions')
          .select('customer_email')
          .in('customer_email', emails)
          .in('event_type', ['refund', 'REFUND', 'chargeback', 'CHARGEBACK']);
        refundEmails = new Set((refunds || []).map(r => (r.customer_email || '').toLowerCase().trim()));
      }

      // 3. Fetch attendees by linked_attendee_id (with R2 filter)
      const attendeeIds = uniqueContracts.map(t => t.linked_attendee_id).filter(Boolean) as string[];
      const attendeeMap = new Map<string, any>();

      if (attendeeIds.length > 0) {
        const { data: attendees } = await supabase
          .from('meeting_slot_attendees')
          .select(ATTENDEE_SELECT)
          .in('id', attendeeIds);

        for (const a of attendees || []) {
          // Only keep R2 attendees, or those without a slot (unassigned)
          const meetingType = (a.meeting_slot as any)?.meeting_type?.toLowerCase() || '';
          if (meetingType === 'r2' || meetingType === '' || !a.meeting_slot_id) {
            attendeeMap.set(a.id, a);
          }
        }
      }

      // 4. Fetch attendees by email → contact_id (R2 only)
      const crmContactMap = new Map<string, string>(); // email → contact_id
      if (emails.length > 0) {
        const { data: contactsWithEmail } = await supabase
          .from('crm_contacts')
          .select('id, email')
          .in('email', emails);

        for (const c of contactsWithEmail || []) {
          if (c.email) crmContactMap.set(c.email.toLowerCase().trim(), c.id);
        }

        const contactIds = Array.from(new Set(crmContactMap.values()));
        if (contactIds.length > 0) {
          const { data: attendeesByContact } = await supabase
            .from('meeting_slot_attendees')
            .select(ATTENDEE_SELECT)
            .in('contact_id', contactIds);

          const contactIdToEmail = new Map<string, string>();
          for (const [email, cid] of crmContactMap) {
            contactIdToEmail.set(cid, email);
          }

          for (const a of attendeesByContact || []) {
            const meetingType = (a.meeting_slot as any)?.meeting_type?.toLowerCase() || '';
            if (meetingType !== 'r2' && a.meeting_slot_id) continue; // skip non-R2

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

      // 5. Phone matching fallback — collect unmatched transaction phones
      const unmatchedPhones: { phone9: string; email: string }[] = [];
      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const hasLinked = tx.linked_attendee_id && attendeeMap.has(tx.linked_attendee_id);
        const hasEmailMatch = attendeeMap.has(`email:${email}`);
        if (!hasLinked && !hasEmailMatch) {
          const phone9 = normalizePhoneSuffix(tx.customer_phone);
          if (phone9) unmatchedPhones.push({ phone9, email });
        }
      }

      if (unmatchedPhones.length > 0) {
        // Fetch all R2 attendees with phones to match against
        const { data: allR2Attendees } = await supabase
          .from('meeting_slot_attendees')
          .select(ATTENDEE_SELECT)
          .not('attendee_phone', 'is', null);

        if (allR2Attendees) {
          // Build phone suffix → attendee map (only R2)
          const phoneSuffixMap = new Map<string, any>();
          for (const a of allR2Attendees) {
            const meetingType = (a.meeting_slot as any)?.meeting_type?.toLowerCase() || '';
            if (meetingType !== 'r2' && a.meeting_slot_id) continue;
            const suffix = normalizePhoneSuffix(a.attendee_phone);
            if (suffix) {
              // Keep most recent by updated_at
              const existing = phoneSuffixMap.get(suffix);
              if (!existing || (a.updated_at && (!existing.updated_at || a.updated_at > existing.updated_at))) {
                phoneSuffixMap.set(suffix, a);
              }
            }
          }

          for (const { phone9, email } of unmatchedPhones) {
            const matched = phoneSuffixMap.get(phone9);
            if (matched && !attendeeMap.has(`phone:${email}`)) {
              attendeeMap.set(`phone:${email}`, matched);
            }
          }
        }
      }

      // 6. Also check which unmatched emails exist in CRM (for classification)
      const allCRMEmails = new Set(crmContactMap.keys());
      // Build phone set from CRM contacts for classification
      let allCRMPhones = new Set<string>();
      if (unmatchedPhones.length > 0) {
        const { data: crmPhones } = await supabase
          .from('crm_contacts')
          .select('phone')
          .not('phone', 'is', null);
        if (crmPhones) {
          for (const c of crmPhones) {
            const s = normalizePhoneSuffix(c.phone);
            if (s) allCRMPhones.add(s);
          }
        }
      }

      // 7. R2 status options
      const { data: r2StatusOptions } = await supabase
        .from('r2_status_options')
        .select('id, name')
        .eq('is_active', true);

      const statusNameMap = new Map<string, string>();
      for (const s of r2StatusOptions || []) {
        statusNameMap.set(s.id, s.name);
      }

      // 8. Process each contract
      const leadsDetalhados: LeadDetalhado[] = [];
      let comunicados = 0;
      let r2Agendadas = 0;
      let r2Realizadas = 0;
      const motivosCount = new Map<string, { count: number; tipo: 'legitima' | 'operacional' }>();
      const stateData = new Map<string, { contratos: number; agendados: number; realizados: number; perdidos: number }>();

      for (const tx of uniqueContracts) {
        const email = (tx.customer_email || '').toLowerCase().trim();
        const hasRefund = refundEmails.has(email);

        // Try all matching strategies
        let attendee = tx.linked_attendee_id ? attendeeMap.get(tx.linked_attendee_id) : null;
        if (!attendee) attendee = attendeeMap.get(`email:${email}`);
        if (!attendee) attendee = attendeeMap.get(`phone:${email}`);

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
          // Check if contact exists in CRM for better classification
          const txPhone9 = normalizePhoneSuffix(tx.customer_phone);
          const contactExistsInCRM = allCRMEmails.has(email) || (txPhone9 ? allCRMPhones.has(txPhone9) : false);

          const loss = classifyLoss(attendee, hasRefund, r2StatusName, contactExistsInCRM);
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
