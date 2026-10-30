import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NotaAttendee {
  note: string | null;
  note_type: string | null;
  created_at: string;
  created_by: string | null;
  autor: string | null;
}

export interface ReuniaoNotas {
  id: string;
  notes: string | null;
  closer_notes: string | null;
  r2_observations: string | null;
  outcome_reason_note: string | null;
  booked_by: string | null;
  booked_by_nome: string | null;
  booked_at: string | null;
  created_at: string | null;
  status: string | null;
  scheduled_at: string | null;
  meeting_type: string | null;
  closer_nome: string | null;
  attendee_notes: NotaAttendee[];
}

/**
 * Notas originais da equipe por participante do negócio.
 * Não usa meeting_slots.notes: é do horário inteiro e pode falar de outro lead do grupo.
 */
export function useNotasReuniaoDoNegocio(dealId?: string | null) {
  return useQuery({
    queryKey: ['notas-reuniao', dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<ReuniaoNotas[]> => {
      const { data, error } = await supabase
        .from('meeting_slot_attendees')
        .select(
          'id, notes, closer_notes, r2_observations, outcome_reason_note, booked_by, booked_at, created_at, status, meeting_slots(scheduled_at, meeting_type, closers(name)), attendee_notes(note, note_type, created_at, created_by)',
        )
        .eq('deal_id', dealId!);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []) as any[];

      const ids = new Set<string>();
      rows.forEach((r) => {
        if (r.booked_by) ids.add(r.booked_by);
        (r.attendee_notes ?? []).forEach((n: { created_by: string | null }) => n.created_by && ids.add(n.created_by));
      });
      const nomes = new Map<string, string>();
      if (ids.size > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', [...ids]);
        (profs ?? []).forEach((p) => p.full_name && nomes.set(p.id, p.full_name));
      }

      return rows
        .map((r) => {
          const slot = Array.isArray(r.meeting_slots) ? r.meeting_slots[0] : r.meeting_slots;
          const closer = slot ? (Array.isArray(slot.closers) ? slot.closers[0] : slot.closers) : null;
          return {
            id: r.id,
            notes: r.notes,
            closer_notes: r.closer_notes,
            r2_observations: r.r2_observations,
            outcome_reason_note: r.outcome_reason_note,
            booked_by: r.booked_by,
            booked_by_nome: r.booked_by ? nomes.get(r.booked_by) ?? null : null,
            booked_at: r.booked_at,
            created_at: r.created_at,
            status: r.status,
            scheduled_at: slot?.scheduled_at ?? null,
            meeting_type: slot?.meeting_type ?? null,
            closer_nome: closer?.name ?? null,
            attendee_notes: ((r.attendee_notes ?? []) as NotaAttendee[])
              .map((n) => ({ ...n, autor: n.created_by ? nomes.get(n.created_by) ?? null : null }))
              .sort((a, b) => a.created_at.localeCompare(b.created_at)),
          } as ReuniaoNotas;
        })
        .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
    },
  });
}
