import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPages, fetchAllByIds } from '@/lib/supabasePaginacao';

/**
 * Funil R1 do Consórcio (etapas 1 e 2 do Funil Pós-Reunião).
 *
 * Regras (mesmas da tela Agenda R1):
 *  - conta PARTICIPANTES (meeting_slot_attendees), nunca slots — um slot pode ter 2 leads
 *  - is_partner = false
 *  - slot com meeting_type = 'r1' e status fora de (cancelled/canceled/cancelada)
 *  - eixo de data: meeting_slots.scheduled_at dentro do período
 *  - recorte de BU: closer_id em closers com bu = 'consorcio', incluindo closers
 *    INATIVOS que tiveram reunião no período (histórico não pode sair do funil)
 *
 * "Realizadas" = SOMENTE status = 'completed'. contract_paid/refunded ficam de fora
 * (o vocabulário "contrato pago" não existe no Consórcio — decisão de negócio).
 *
 * DEDUP (obrigatório para bater com o Painel Comercial / `get_agenda_fatos_consorcio`):
 *  - 1 ocorrência por (deal_id, dia da reunião), priorizando completed > no_show > resto
 *  - cap de 2 ocorrências por deal dentro do período (as 2 primeiras por data)
 * Sem isso a tela inflava com remarcações do mesmo lead.
 */

const CANCELLED_SLOT_STATUS = new Set(['cancelled', 'canceled', 'cancelada']);
const SEM_DESFECHO_STATUS = new Set(['invited', 'scheduled', 'rescheduled']);

/** Dia da reunião em America/Sao_Paulo (YYYY-MM-DD) — mesmo eixo do RPC. */
function spDay(iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function statusRank(status: string): number {
  if (status === 'completed') return 0;
  if (status === 'no_show') return 1;
  return 2;
}

/**
 * Aplica dedup 1 por (deal, dia) + cap 2 por deal — espelho exato do RPC
 * `get_agenda_fatos_consorcio`. Participantes sem deal_id são a própria unidade
 * (chave `msa:<id>`), como no RPC.
 */
function dedupComCap(participants: R1FunnelParticipant[]): R1FunnelParticipant[] {
  const porUnidadeDia = new Map<string, R1FunnelParticipant>();
  participants.forEach((p) => {
    const unit = p.deal_id || `msa:${p.id}`;
    const day = spDay(p.scheduled_at);
    const key = `${unit}|${day}`;
    const atual = porUnidadeDia.get(key);
    if (!atual || statusRank(p.status) < statusRank(atual.status)) {
      porUnidadeDia.set(key, p);
    }
  });

  const porUnidade = new Map<string, R1FunnelParticipant[]>();
  porUnidadeDia.forEach((p) => {
    const unit = p.deal_id || `msa:${p.id}`;
    const arr = porUnidade.get(unit);
    if (arr) arr.push(p);
    else porUnidade.set(unit, [p]);
  });

  const out: R1FunnelParticipant[] = [];
  porUnidade.forEach((arr) => {
    arr
      .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))
      .slice(0, 2)
      .forEach((p) => out.push(p));
  });
  return out;
}

export interface R1FunnelParticipant {
  id: string;
  meeting_slot_id: string;
  deal_id: string | null;
  contact_id: string | null;
  lead_name: string;
  lead_phone: string;
  scheduled_at: string;
  closer_name: string;
  status: string;
  closer_notes: string;
  notes: string;
  sem_desfecho: boolean;
  is_partner: boolean;
  parent_attendee_id: string | null;
  outcome_reason: string | null;
  outcome_reason_note: string | null;
}

export interface R1FunnelResult {
  agendadas: number;
  realizadas: number;
  noShow: number;
  semDesfecho: number;
  participants: R1FunnelParticipant[];
}

/** Rótulos curtos usados na Agenda R1. */
export function r1StatusShortLabel(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return 'OK';
    case 'no_show':
      return 'NS';
    case 'rescheduled':
      return 'RE';
    default:
      return 'Ag';
  }
}

export function useConsorcioR1Funnel(
  range: { startDate?: Date; endDate?: Date },
  options?: { enabled?: boolean },
) {
  const startIso = range.startDate ? range.startDate.toISOString() : null;
  const endIso = range.endDate
    ? new Date(
        range.endDate.getFullYear(),
        range.endDate.getMonth(),
        range.endDate.getDate(),
        23, 59, 59, 999,
      ).toISOString()
    : null;

  return useQuery<R1FunnelResult>({
    queryKey: ['consorcio-r1-funnel', startIso, endIso],
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // 1) Closers do Consórcio (ativos) + inativos com slot no período
      const { data: activeClosers, error: closersError } = await supabase
        .from('closers')
        .select('id, name, is_active')
        .eq('bu', 'consorcio');
      if (closersError) throw closersError;

      const closerName = new Map<string, string>();
      (activeClosers || []).forEach((c: any) => closerName.set(c.id, c.name));
      const closerIds = new Set<string>(closerName.keys());

      // 2) Slots R1 do período (paginado: sem .range() o PostgREST trunca em 1000)
      const slots = await fetchAllPages<any>((from, to) => {
        let slotQuery = supabase
          .from('meeting_slots')
          .select('id, scheduled_at, status, closer_id')
          .eq('meeting_type', 'r1');
        if (startIso) slotQuery = slotQuery.gte('scheduled_at', startIso);
        if (endIso) slotQuery = slotQuery.lte('scheduled_at', endIso);
        return slotQuery
          .order('scheduled_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to);
      });

      const validSlots = (slots || []).filter(
        (s: any) =>
          s.closer_id &&
          closerIds.has(s.closer_id) &&
          !CANCELLED_SLOT_STATUS.has(String(s.status || '').toLowerCase()),
      );

      // Closers inativos/de outra BU não entram; mas closers do Consórcio já
      // desativados continuam em `closers` com bu='consorcio' (não filtramos is_active).
      if (validSlots.length === 0) {
        return { agendadas: 0, realizadas: 0, noShow: 0, semDesfecho: 0, participants: [] };
      }

      const slotById = new Map<string, any>(validSlots.map((s: any) => [s.id, s]));

      // 3) Participantes dos slots (lotes de 200 ids, com paginação dentro do lote:
      //    um slot pode ter vários participantes, então 200 ids passam de 1000 linhas)
      const rows = await fetchAllByIds<any>(
        Array.from(slotById.keys()),
        (lote, from, to) =>
          supabase
            .from('meeting_slot_attendees')
            .select(
              'id, meeting_slot_id, deal_id, contact_id, attendee_name, attendee_phone, status, closer_notes, notes, is_partner, parent_attendee_id, outcome_reason, outcome_reason_note',
            )
            .in('meeting_slot_id', lote)
            .eq('is_partner', false)
            .order('id', { ascending: true })
            .range(from, to),
      );

      // 3.1) Fallback de identidade em LOTE (nunca por linha):
      //      muitos attendees nascem sem attendee_name/attendee_phone (webhook,
      //      criação via slot). O vínculo contact_id/deal_id continua íntegro,
      //      então resolvemos nome/telefone a partir de crm_contacts e crm_deals.
      const contactIds = Array.from(
        new Set(rows.map((a) => a.contact_id).filter(Boolean) as string[]),
      );
      const dealIds = Array.from(
        new Set(rows.map((a) => a.deal_id).filter(Boolean) as string[]),
      );

      const [contactRows, dealRows] = await Promise.all([
        contactIds.length
          ? fetchAllByIds<any>(contactIds, (lote, from, to) =>
              supabase
                .from('crm_contacts')
                .select('id, name, phone')
                .in('id', lote)
                .order('id', { ascending: true })
                .range(from, to),
            )
          : Promise.resolve([] as any[]),
        dealIds.length
          ? fetchAllByIds<any>(dealIds, (lote, from, to) =>
              supabase
                .from('crm_deals')
                .select('id, name')
                .in('id', lote)
                .order('id', { ascending: true })
                .range(from, to),
            )
          : Promise.resolve([] as any[]),
      ]);

      const contactById = new Map<string, any>(contactRows.map((c) => [c.id, c]));
      const dealNameById = new Map<string, string>(dealRows.map((d) => [d.id, d.name]));

      /** '' e '   ' contam como ausente — `||` sozinho deixava passar espaços. */
      const limpo = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

      const now = Date.now();
      const participants: R1FunnelParticipant[] = rows.map((a) => {
        const slot = slotById.get(a.meeting_slot_id);
        const status = String(a.status || '').toLowerCase();
        const scheduledAt = slot?.scheduled_at || '';
        const passou = scheduledAt ? new Date(scheduledAt).getTime() < now : false;
        const contato = a.contact_id ? contactById.get(a.contact_id) : null;
        // attendee → contato → negócio → '—'
        const nome =
          limpo(a.attendee_name) ||
          limpo(contato?.name) ||
          (a.deal_id ? limpo(dealNameById.get(a.deal_id)) : '') ||
          '—';
        // attendee → contato → '' (a tela já exibe '—' quando vazio)
        const telefone = limpo(a.attendee_phone) || limpo(contato?.phone) || '';
        return {
          id: a.id,
          meeting_slot_id: a.meeting_slot_id,
          deal_id: a.deal_id || null,
          contact_id: a.contact_id || null,
          lead_name: nome,
          lead_phone: telefone,
          scheduled_at: scheduledAt,
          closer_name: (slot?.closer_id && closerName.get(slot.closer_id)) || '—',
          status,
          closer_notes: a.closer_notes || '',
          notes: a.notes || '',
          sem_desfecho: passou && SEM_DESFECHO_STATUS.has(status),
          is_partner: !!a.is_partner,
          parent_attendee_id: a.parent_attendee_id || null,
          outcome_reason: a.outcome_reason || null,
          outcome_reason_note: a.outcome_reason_note || null,
        };
      });


      const deduped = dedupComCap(participants);
      deduped.sort((a, b) => (b.scheduled_at || '').localeCompare(a.scheduled_at || ''));

      return {
        agendadas: deduped.length,
        realizadas: deduped.filter((p) => p.status === 'completed').length,
        noShow: deduped.filter((p) => p.status === 'no_show').length,
        semDesfecho: deduped.filter((p) => p.sem_desfecho).length,
        participants: deduped,
      };
    },
  });
}
