import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContactDealIds } from './useContactDealIds';

export type TimelineEventType = 'stage_change' | 'call' | 'note' | 'meeting' | 'task' | 'purchase' | 'qualification' | 'closer_note' | 'entry';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string | null;
  date: string;
  author: string | null;
  metadata: Record<string, any>;
}

interface UseLeadFullTimelineParams {
  dealId: string;
  dealUuid: string;
  contactEmail?: string | null;
  contactId?: string | null;
}

export function useLeadFullTimeline({ dealId, dealUuid, contactEmail, contactId }: UseLeadFullTimelineParams) {
  const { data: allDealIds = [dealUuid, dealId] } = useContactDealIds(dealUuid, contactId);

  // Deduplicate IDs
  const uniqueIds = [...new Set([...allDealIds, dealUuid, dealId].filter(Boolean))];

  return useQuery({
    queryKey: ['lead-full-timeline', uniqueIds, contactEmail],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const events: TimelineEvent[] = [];

      // Build OR filter for deal_activities (supports both UUID and clint_id)
      const orFilter = uniqueIds.map(id => `deal_id.eq.${id}`).join(',');

      // Build UUID-only filter for tables with proper UUID FK
      const uuidIds = uniqueIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

      // Run all queries in parallel
      const [activitiesRes, callsRes, meetingsRes, transactionsRes, attendeeNotesRes, dealsRes] = await Promise.all([
        // 1. Deal activities (stage changes, notes, tasks, qualification) - ALL deals
        supabase
          .from('deal_activities')
          .select('*')
          .or(orFilter)
          .order('created_at', { ascending: false })
          .limit(500),

        // 2. Calls - ALL deals
        supabase
          .from('calls')
          .select('*')
          .in('deal_id', uniqueIds)
          .order('created_at', { ascending: false })
          .limit(100),

        // 3. Meetings (attendees + slots) - ALL deals
        supabase
          .from('meeting_slot_attendees')
          .select('*, meeting_slots(*, closers(name))')
          .in('deal_id', uniqueIds)
          .order('created_at', { ascending: false })
          .limit(50),

        // 4. Transactions by email
        contactEmail
          ? supabase
              .from('hubla_transactions')
              .select('id, product_name, product_price, net_value, sale_date, sale_status, source, installment_number, total_installments')
              .eq('customer_email', contactEmail)
              .order('sale_date', { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),

        // 5. Attendee notes - ALL deals
        supabase
          .from('attendee_notes')
          .select('*, meeting_slot_attendees!inner(deal_id)')
          .in('meeting_slot_attendees.deal_id', uniqueIds)
          .order('created_at', { ascending: false })
          .limit(50),

        // 6. Deal basic info for synthesizing entry events
        uuidIds.length > 0
          ? supabase
              .from('crm_deals')
              .select('id, created_at, origin_id, owner_id')
              .in('id', uuidIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Collect all author user_ids and stage UUIDs in one pass
      const authorUuids = new Set<string>();
      const stageUuids = new Set<string>();

      if (activitiesRes.data) {
        for (const act of activitiesRes.data) {
          if (act.user_id && UUID_RE.test(act.user_id)) authorUuids.add(act.user_id);
          const aType = act.activity_type || '';
          if (aType === 'stage_change' || aType === 'stage_changed') {
            const meta = (act.metadata as Record<string, any>) || {};
            const from = act.from_stage || meta.from_stage || '';
            const to = act.to_stage || meta.to_stage || '';
            if (UUID_RE.test(from)) stageUuids.add(from.toLowerCase());
            if (UUID_RE.test(to)) stageUuids.add(to.toLowerCase());
          }
        }
      }
      if (callsRes.data) {
        for (const call of callsRes.data) {
          if (call.user_id && UUID_RE.test(call.user_id)) authorUuids.add(call.user_id);
        }
      }
      if (attendeeNotesRes.data) {
        for (const note of attendeeNotesRes.data) {
          if (note.created_by && UUID_RE.test(note.created_by)) authorUuids.add(note.created_by);
        }
      }
      if (dealsRes.data) {
        for (const deal of dealsRes.data) {
          if (deal.owner_id && UUID_RE.test(deal.owner_id)) authorUuids.add(deal.owner_id);
        }
      }

      // Resolve stages and profiles in parallel
      const [stagesResult, profilesResult] = await Promise.all([
        stageUuids.size > 0
          ? supabase.from('crm_stages').select('id, stage_name').in('id', [...stageUuids])
          : Promise.resolve({ data: [] as { id: string; stage_name: string }[] }),
        authorUuids.size > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', [...authorUuids])
          : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
      ]);

      const stageNameMap: Record<string, string> = {};
      if (stagesResult.data) {
        for (const s of stagesResult.data) {
          stageNameMap[s.id.toLowerCase()] = s.stage_name;
        }
      }

      const profileMap: Record<string, string> = {};
      if (profilesResult.data) {
        for (const p of profilesResult.data) {
          profileMap[p.id] = p.full_name || p.email || 'Usuário';
        }
      }

      const resolveStageName = (val: string | null | undefined): string => {
        if (!val) return '?';
        if (UUID_RE.test(val)) return stageNameMap[val.toLowerCase()] || val;
        return val;
      };

      const resolveAuthor = (userId: string | null | undefined, ...fallbacks: (string | null | undefined)[]): string | null => {
        for (const fb of fallbacks) {
          if (fb) return fb;
        }
        if (userId && profileMap[userId]) return profileMap[userId];
        return null;
      };

      // Process deal_activities
      if (activitiesRes.data) {
        for (const act of activitiesRes.data) {
          const actType = act.activity_type || '';
          const meta = (act.metadata as Record<string, any>) || {};

          if (actType === 'stage_change' || actType === 'stage_changed') {
            const fromName = resolveStageName(act.from_stage || meta.from_stage);
            const toName = resolveStageName(act.to_stage || meta.to_stage);
            events.push({
              id: act.id,
              type: 'stage_change',
              title: `${fromName} → ${toName}`,
              description: act.description,
              date: act.created_at,
              author: resolveAuthor(act.user_id, meta.owner_email, meta.deal_user, meta.changed_by),
              metadata: { from_stage: fromName, to_stage: toName, ...meta },
            });
          } else if (actType === 'note' || actType === 'manual_note') {
            events.push({
              id: act.id,
              type: 'note',
              title: 'Nota adicionada',
              description: act.description,
              date: act.created_at,
              author: resolveAuthor(act.user_id, meta.author, meta.user_name),
              metadata: meta,
            });
          } else if (actType === 'task_completed' || actType === 'task_complete') {
            events.push({
              id: act.id,
              type: 'task',
              title: `Tarefa concluída: ${act.description || 'Sem título'}`,
              description: null,
              date: act.created_at,
              author: resolveAuthor(act.user_id, meta.completed_by, meta.user_name),
              metadata: meta,
            });
          } else if (actType === 'qualification_note' || actType === 'qualification') {
            events.push({
              id: act.id,
              type: 'qualification',
              title: 'Lead qualificado',
              description: act.description,
              date: act.created_at,
              author: meta.sdr_name || meta.author || null,
              metadata: meta,
            });
          } else if (actType) {
            // Other activity types
            events.push({
              id: act.id,
              type: 'note',
              title: actType.replace(/_/g, ' '),
              description: act.description,
              date: act.created_at,
              author: meta.author || meta.user_name || null,
              metadata: { original_type: actType, ...meta },
            });
          }
        }
      }

      // Process calls
      if (callsRes.data) {
        for (const call of callsRes.data) {
          const duration = call.duration_seconds
            ? `${Math.floor(call.duration_seconds / 60)}m${call.duration_seconds % 60}s`
            : null;
          const outcomeLabel = call.outcome || call.status || 'Sem resultado';
          events.push({
            id: call.id,
            type: 'call',
            title: `Ligação: ${outcomeLabel}`,
            description: call.notes,
            date: call.started_at || call.created_at || '',
            author: null,
            metadata: {
              direction: call.direction,
              duration,
              duration_seconds: call.duration_seconds,
              outcome: call.outcome,
              status: call.status,
              to_number: call.to_number,
              recording_url: call.recording_url,
            },
          });
        }
      }

      // Process meetings
      if (meetingsRes.data) {
        for (const att of meetingsRes.data) {
          const slot = att.meeting_slots as any;
          const closerName = slot?.closers?.name || null;
          const scheduledAt = slot?.scheduled_at;
          events.push({
            id: att.id,
            type: 'meeting',
            title: `Reunião ${att.status === 'completed' ? 'realizada' : att.status === 'no_show' ? 'No-Show' : 'agendada'}${closerName ? ` com ${closerName}` : ''}`,
            description: att.closer_notes || null,
            date: att.booked_at || att.created_at || '',
            author: closerName,
            metadata: {
              status: att.status,
              scheduled_at: scheduledAt,
              closer_name: closerName,
              meeting_type: slot?.meeting_type,
              google_meet_link: slot?.google_meet_link,
              closer_notes: att.closer_notes,
              sdr_notes: null,
            },
          });

          // Add closer_notes as separate event if present
          if (att.closer_notes) {
            events.push({
              id: `${att.id}-closer-note`,
              type: 'closer_note',
              title: `Nota do Closer: ${closerName || 'Closer'}`,
              description: att.closer_notes,
              date: att.updated_at || att.created_at || '',
              author: closerName,
              metadata: { attendee_id: att.id },
            });
          }
        }
      }

      // Process transactions
      if (transactionsRes.data) {
        for (const tx of transactionsRes.data) {
          const price = tx.product_price ? `R$ ${(tx.product_price / 100).toFixed(2)}` : '';
          const parcela = tx.installment_number && tx.total_installments
            ? ` (${tx.installment_number}/${tx.total_installments})`
            : '';
          events.push({
            id: tx.id,
            type: 'purchase',
            title: `Compra: ${tx.product_name || 'Produto'}${parcela}`,
            description: `${price} via ${tx.source || 'desconhecido'} - ${tx.sale_status || ''}`,
            date: tx.sale_date || '',
            author: null,
            metadata: {
              product_name: tx.product_name,
              product_price: tx.product_price,
              net_value: tx.net_value,
              sale_status: tx.sale_status,
              source: tx.source,
              installment_number: tx.installment_number,
              total_installments: tx.total_installments,
            },
          });
        }
      }

      // Process attendee notes
      if (attendeeNotesRes.data) {
        for (const note of attendeeNotesRes.data) {
          events.push({
            id: note.id,
            type: 'note',
            title: `Nota: ${note.note_type || 'Geral'}`,
            description: note.note,
            date: note.created_at || '',
            author: null,
            metadata: { note_type: note.note_type, attendee_id: note.attendee_id },
          });
        }
      }

      // Synthesize "Entrada na Pipeline" for each deal if no event exists near created_at
      if (dealsRes.data) {
        for (const deal of dealsRes.data) {
          if (!deal.created_at) continue;
          const dealCreatedMs = new Date(deal.created_at).getTime();
          const TOLERANCE_MS = 60_000; // 1 minute
          const hasEntryEvent = events.some(
            e => (e.type === 'entry' || e.type === 'stage_change') &&
              Math.abs(new Date(e.date).getTime() - dealCreatedMs) < TOLERANCE_MS
          );
          if (!hasEntryEvent) {
            events.push({
              id: `entry-${deal.id}`,
              type: 'entry',
              title: 'Entrada na Pipeline',
              description: 'Lead entrou na pipeline',
              date: deal.created_at,
              author: deal.owner_id || null,
              metadata: { deal_id: deal.id, origin_id: deal.origin_id, synthetic: true },
            });
          }
        }
      }

      // Sort all events by date descending
      events.sort((a, b) => {
        const da = new Date(a.date).getTime() || 0;
        const db = new Date(b.date).getTime() || 0;
        return db - da;
      });

      return events;
    },
    enabled: uniqueIds.length > 0,
    staleTime: 30000,
  });
}
