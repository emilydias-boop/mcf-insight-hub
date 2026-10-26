import { OUTCOME_LABELS, STATUS_LABELS, formatDuration, getCallDuration } from '@/components/crm/timeline/callPresentation';
import { MEETING_STATUS, metadataAuthor, activityIsAutomatic, hasCorrespondingHangup, otherActivityPresentation, contatoRegistradoPresentation } from '@/components/crm/timeline/eventPresentation';
import { sonaxDurationSeconds } from '@/lib/sonaxRecording';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContactDealIds } from './useContactDealIds';
import type { LeadReportMeeting } from './useLeadReport';

export type TimelineEventType = 'stage_change' | 'call' | 'note' | 'ai_summary' | 'attendee_note' | 'scheduling_note' | 'meeting' | 'task' | 'purchase' | 'qualification' | 'closer_note' | 'entry' | 'tag_change' | 'owner_change' | 'automation' | 'refund';

// Rótulos PT-BR para os tipos que antes caíam no catch-all de "Notas"
const OWNERSHIP_TYPES: Record<string, string> = {
  owner_change: 'Responsável alterado',
  closer_change: 'Closer alterado',
  lead_distribution: 'Lead distribuído',
  lead_distributed: 'Lead distribuído',
};

const AUTOMATION_TYPES: Record<string, string> = {
  webhook_reentry: 'Reentrada via webhook',
  partner_detected: 'Parceria detectada',
  outside_detected: 'Venda Outside detectada',
  auto_move: 'Movimentação automática',
};

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string | null;
  date: string;
  author: string | null;
  automatic?: boolean;
  metadata: Record<string, any>;
}

interface UseLeadFullTimelineParams {
  dealId: string;
  dealUuid: string;
  contactEmail?: string | null;
  contactId?: string | null;
  /**
   * Reuniões já lidas por outro consumidor (Relatório do Lead). Quando informado,
   * a timeline NÃO consulta `meeting_slot_attendees` de novo — leitura única.
   */
  meetings?: LeadReportMeeting[] | null;
  enabled?: boolean;
}

export function useLeadFullTimeline({
  dealId,
  dealUuid,
  contactEmail,
  contactId,
  meetings: externalMeetings,
  enabled = true,
}: UseLeadFullTimelineParams) {
  const idsQuery = useContactDealIds(dealUuid, contactId);
  const allDealIds = idsQuery.data ?? [dealUuid, dealId];
  // Só busca depois de saber todos os negócios do contato (evita rodar duas vezes).
  const idsProntos = idsQuery.isSuccess || idsQuery.isError || (!dealUuid && !contactId);

  // Deduplicate IDs
  const uniqueIds = [...new Set([...allDealIds, dealUuid, dealId].filter(Boolean))];
  const useExternalMeetings = Array.isArray(externalMeetings);
  const externalMeetingsKey = useExternalMeetings
    ? (externalMeetings as LeadReportMeeting[]).map((m) => `${m.id}:${m.status ?? ''}`).join('|')
    : null;

  return useQuery({
    queryKey: ['lead-full-timeline', uniqueIds, contactEmail, externalMeetingsKey],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const events: TimelineEvent[] = [];

      // Build OR filter for deal_activities (supports both UUID and clint_id)
      const orFilter = uniqueIds.map(id => `deal_id.eq.${id}`).join(',');

      // Build UUID-only filter for tables with proper UUID FK
      const uuidIds = uniqueIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

      // Run all queries in parallel
      const [activitiesResRaw, callsRes, meetingsRes, transactionsRes, attendeeNotesRes, dealsRes] = await Promise.all([
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

        // 3. Meetings (attendees + slots) - ALL deals.
        //    Reaproveita a leitura externa quando ela existe (evita duas verdades).
        useExternalMeetings
          ? Promise.resolve({
              data: (externalMeetings as LeadReportMeeting[]).map((m) => ({
                id: m.id,
                status: m.status,
                booked_by: null,
                booked_at: m.booked_at,
                created_at: m.created_at,
                updated_at: m.updated_at,
                closer_notes: m.closer_notes,
                notes: m.notes,
                booked_by_name: m.booked_by_name,
                meeting_slots: {
                  scheduled_at: m.scheduled_at,
                  meeting_type: m.meeting_type,
                  google_meet_link: m.google_meet_link,
                  closers: m.closer_name ? { name: m.closer_name } : null,
                },
              })),
              error: null,
            })
          : supabase
              .from('meeting_slot_attendees')
              .select('*, meeting_slots(*, closers(name))')
              .in('deal_id', uniqueIds)
              .order('created_at', { ascending: false })
              .limit(50),

        // 4. Transactions by email — fonte única: RPC get_compras_do_cliente
        contactEmail
          ? supabase.rpc('get_compras_do_cliente' as any, { p_email: contactEmail.trim().toLowerCase() })
          : Promise.resolve({ data: [], error: null }),

        // 5. Attendee notes - ALL deals
        supabase
          .from('attendee_notes')
          .select('*, meeting_slot_attendees!inner(deal_id)')
          .in('meeting_slot_attendees.deal_id', uniqueIds)
          .order('created_at', { ascending: false })
          .limit(50),

        // 6. Deal basic info for synthesizing entry events + pipeline name
        uuidIds.length > 0
          ? supabase
              .from('crm_deals')
              .select('id, created_at, origin_id, owner_id, crm_origins(name, display_name)')
              .in('id', uuidIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Só visual: esconde a cópia com UUIDs de movimento automático (a linha do gatilho é exibida).
      const activitiesRes = { ...activitiesResRaw, data: (activitiesResRaw.data || []).filter(a => !isAutoStageCopyRow(a)) };

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

      // Build dealId → pipeline name map
      const dealIdToPipelineName: Record<string, string> = {};
      if (dealsRes.data) {
        for (const deal of dealsRes.data as any[]) {
          const origin = deal.crm_origins;
          if (origin) {
            dealIdToPipelineName[deal.id] = origin.display_name || origin.name || '';
          }
        }
      }

      const resolveStageName = (val: string | null | undefined): string => {
        if (!val) return '?';
        if (UUID_RE.test(val)) return stageNameMap[val.toLowerCase()] || val;
        return val;
      };

      const resolveAuthor = (userId: string | null | undefined, ...fallbacks: (string | null | undefined)[]): string => {
        if (userId) return profileMap[userId] || userId;
        return fallbacks.find(Boolean) || 'Automático';
      };

      // Process deal_activities
      if (activitiesRes.data) {
        const hangups = activitiesRes.data.filter(a => a.activity_type === 'ligacao_sonax_desligamento');
        for (const act of activitiesRes.data) {
          const actType = act.activity_type || '';
          const meta = (act.metadata as Record<string, any>) || {};

          if ((actType === 'ligacao_sonax_atendimento' || actType === 'click_to_call') && hasCorrespondingHangup(act, hangups)) continue;
          // Registro só com próxima ação: o next_action_scheduled gravado junto já mostra o evento.
          const contato = actType === 'contato_registrado' ? contatoRegistradoPresentation(meta) : null;
          if (actType === 'contato_registrado' && !contato) continue;
          const eventStart = events.length;
          const author = resolveAuthor(act.user_id, metadataAuthor(meta, actType));
          const automatic = activityIsAutomatic(actType, act.user_id, meta);
          if (actType === 'ligacao_sonax_desligamento' || actType === 'ligacao_sonax_atendimento' || actType === 'click_to_call') {
            const answered = String(meta.STATUS_ATENDIMENTO || '').toUpperCase() === 'S';
            const seconds = sonaxDurationSeconds(String(meta.DURACAO_CHAMADA || ''));
            events.push({
              id: act.id, type: 'call',
              title: actType === 'ligacao_sonax_desligamento' ? (answered ? 'Ligação atendida' : 'Ligação não atendida') : 'Tentativa de ligação',
              description: act.description, date: act.created_at, author, automatic,
              metadata: { ...meta, original_type: actType, source: 'sonax', duration: formatDuration(seconds),
                duration_seconds: seconds, recording_url: answered ? meta.URL_GRAVACAO : null,
                ramal: meta.ALIASRAMAL || meta.RAMAL, sdr_name: meta.sdr_name || meta.sdr_email },
            });
          } else if (contato) {
            events.push({ id: act.id, type: 'call', title: contato.title, description: contato.body, date: act.created_at,
              author, metadata: { ...meta, original_type: actType, contato_icone: contato.icon } });
          } else if (actType === 'ai_call_summary') {
            events.push({ id: act.id, type: 'ai_summary', title: 'Resumo IA da ligação', description: act.description,
              date: act.created_at, author, metadata: { ...meta, original_type: actType } });
          } else if (actType === 'lead_entered') {
            // Webhook entry event — show source info
            const endpointName = meta.endpoint_name || meta.endpoint_slug || meta.source || '';
            const pipelineName = dealIdToPipelineName[act.deal_id] || meta.pipeline_name || '';
            const titleParts = ['Entrada'];
            if (endpointName) titleParts.push(`via ${endpointName}`);
            if (pipelineName) titleParts.push(`— ${pipelineName}`);
            events.push({
              id: act.id,
              type: 'entry',
              title: titleParts.join(' '),
              description: act.description,
              date: act.created_at,
              author,
              metadata: { endpoint_name: endpointName, pipeline_name: pipelineName, ...meta },
            });
          } else if (actType === 'stage_change' || actType === 'stage_changed') {
            const fromName = resolveStageName(act.from_stage || meta.from_stage);
            const toName = resolveStageName(act.to_stage || meta.to_stage);
            const pipelineName = dealIdToPipelineName[act.deal_id] || meta.pipeline_name || null;
            events.push({
              id: act.id,
              type: 'stage_change',
              title: `${fromName} → ${toName}`,
              description: act.description,
              date: act.created_at,
              author,
              metadata: { from_stage: fromName, to_stage: toName, pipeline_name: pipelineName, ...meta },
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
              author: resolveAuthor(act.user_id, meta.sdr_name, meta.author),
              metadata: meta,
            });
          } else if (actType === 'tags_changed' || actType === 'tags_added') {
            const added = (meta.added as string[]) || [];
            const removed = (meta.removed as string[]) || [];
            const source = meta.source || 'sistema';
            const isInitial = !!meta.initial;
            const titleParts: string[] = [];
            if (added.length > 0) titleParts.push(`+ ${added.join(', ')}`);
            if (removed.length > 0) titleParts.push(`− ${removed.join(', ')}`);
            const title = isInitial
              ? `Tags iniciais: ${added.join(', ')}`
              : `Tags ${titleParts.join(' / ') || 'alteradas'}`;
            events.push({
              id: act.id,
              type: 'tag_change',
              title,
              description: act.description,
              date: act.created_at,
              author: resolveAuthor(act.user_id),
              metadata: { added, removed, source, initial: isInitial, ...meta },
            });
          } else if (OWNERSHIP_TYPES[actType]) {
            events.push({
              id: act.id,
              type: 'owner_change',
              title: OWNERSHIP_TYPES[actType],
              description: act.description,
              date: act.created_at,
              author: resolveAuthor(act.user_id, meta.transferred_by, meta.moved_by_name, meta.moved_by_email),
              metadata: { original_type: actType, ...meta },
            });
          } else if (actType.startsWith('refund_')) {
            events.push({
              id: act.id,
              type: 'refund',
              title: 'Reembolso de contrato',
              description: act.description,
              date: act.created_at,
              author: resolveAuthor(act.user_id, meta.changed_by),
              metadata: { original_type: actType, ...meta },
            });
          } else if (AUTOMATION_TYPES[actType]) {
            events.push({
              id: act.id,
              type: 'automation',
              title: AUTOMATION_TYPES[actType],
              description: act.description,
              date: act.created_at,
              author: resolveAuthor(act.user_id, meta.moved_by_name, meta.changed_by),
              metadata: { original_type: actType, ...meta },
            });
          } else if (actType) {
            const target = meta.target_origin_id ? dealIdToPipelineName[meta.target_deal_id] : null;
            const destination = target || act.description?.match(/pipeline "([^"]+)"/i)?.[1]
              || (act.description?.includes('Inside Sales') ? 'Inside Sales' : null);
            const presentation = otherActivityPresentation(actType, { ...meta, target_pipeline_name: meta.target_pipeline_name || destination });
            events.push({
              id: act.id, ...presentation, description: act.description, date: act.created_at,
              author, metadata: { ...meta, original_type: actType },
            });
          }
          for (const event of events.slice(eventStart)) {
            event.author = author;
            event.automatic = automatic;
            event.metadata.original_type = actType;
          }
        }
      }

      // Process calls
      if (callsRes.data) {
        for (const call of callsRes.data) {
          const seconds = getCallDuration(call);
          const duration = formatDuration(seconds);
          const outcomeLabel = (call.outcome && OUTCOME_LABELS[call.outcome]?.label) || STATUS_LABELS[call.status]?.label || 'Sem resultado';
          events.push({
            id: call.id,
            type: 'call',
            title: `Ligação: ${outcomeLabel}`,
            description: call.notes,
            date: call.started_at || call.created_at || '',
            author: resolveAuthor(call.user_id),
            automatic: !call.user_id,
            metadata: {
              direction: call.direction,
              duration,
              duration_seconds: seconds,
              status_label: STATUS_LABELS[call.status]?.label,
              outcome_label: call.outcome ? OUTCOME_LABELS[call.outcome]?.label : null,
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
        // Resolve nomes de quem agendou (booked_by → profiles.full_name)
        const bookerIds = Array.from(new Set(
          (meetingsRes.data || [])
            .map((a: any) => a.booked_by)
            .filter(Boolean)
        ));
        let bookerNameMap = new Map<string, string>();
        if (bookerIds.length > 0) {
          const { data: bookers } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', bookerIds);
          (bookers || []).forEach((p: any) => {
            bookerNameMap.set(p.id, p.full_name || p.email || '');
          });
        }

        for (const att of meetingsRes.data as any[]) {
          const slot = att.meeting_slots as any;
          const closerName = slot?.closers?.name || null;
          const scheduledAt = slot?.scheduled_at;
          const bookedByName = att.booked_by
            ? bookerNameMap.get(att.booked_by) || null
            : att.booked_by_name || null;
          events.push({
            id: att.id,
            type: 'meeting',
            title: `Reunião ${slot?.meeting_type?.toUpperCase() || ''} · ${MEETING_STATUS[att.status] || 'status não informado'}${closerName ? ` com ${closerName}` : ''}`,
            description: att.closer_notes || null,
            date: att.booked_at || att.created_at || '',
            // Mostra quem agendou ao lado da data; cai para o closer se desconhecido
            author: bookedByName || closerName,
            automatic: !bookedByName && !closerName,
            metadata: {
              status: att.status,
              scheduled_at: scheduledAt,
              closer_name: closerName,
              booked_by_name: bookedByName,
              booked_at: att.booked_at,
              meeting_type: slot?.meeting_type,
              google_meet_link: slot?.google_meet_link,
              closer_notes: att.closer_notes,
              sdr_notes: att.notes || null,
              status_label: MEETING_STATUS[att.status] || att.status,
            },
          });

          if (att.notes?.trim()) {
            events.push({ id: `${att.id}-sdr-note`, type: 'scheduling_note', title: `Nota de agendamento ${slot?.meeting_type?.toUpperCase() || ''}`,
              description: att.notes, date: att.booked_at || att.created_at || '', author: bookedByName,
              metadata: { attendee_id: att.id, original_type: 'scheduling_note' } });
          }

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

      // Process transactions — já em REAIS, sem dividir por 100
      if (transactionsRes.data) {
        for (const c of transactionsRes.data as any[]) {
          const parcela = c.parcela && c.total_parcelas ? ` (${c.parcela}/${c.total_parcelas})` : '';
          events.push({
            id: c.id,
            type: 'purchase',
            title: `Compra: ${c.produto || 'Produto'}${parcela}`,
            description: null,
            date: c.sale_date || '',
            author: null,
            metadata: {
              produto: c.produto,
              bu: c.bu,
              gateway: c.gateway,
              bruto: Number(c.bruto) || 0,
              liquido: Number(c.liquido) || 0,
              status: c.status,
              reembolsado: !!c.reembolsado,
              parcela: c.parcela,
              total_parcelas: c.total_parcelas,
            },
          });
        }
      }

      // Process attendee notes
      if (attendeeNotesRes.data) {
        for (const note of attendeeNotesRes.data) {
          events.push({
            id: note.id,
            type: note.note_type === 'call_summary' ? 'ai_summary' : 'attendee_note',
            title: note.note_type === 'reschedule' ? 'Reagendamento' : note.note_type === 'call_summary' ? 'Resumo IA' : 'Nota da reunião',
            description: note.note,
            date: note.created_at || '',
            author: resolveAuthor(note.created_by),
            automatic: !note.created_by,
            metadata: { note_type: note.note_type, attendee_id: note.attendee_id, original_type: 'attendee_notes' },
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
            const pipelineName = dealIdToPipelineName[deal.id] || null;
            events.push({
              id: `entry-${deal.id}`,
              type: 'entry',
              title: pipelineName ? `Entrada: ${pipelineName}` : 'Entrada na Pipeline',
              description: pipelineName ? `Lead entrou na pipeline ${pipelineName}` : 'Lead entrou na pipeline',
              date: deal.created_at,
              author: 'Automático',
              automatic: true,
              metadata: { deal_id: deal.id, origin_id: deal.origin_id, pipeline_name: pipelineName, synthetic: true },
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
    enabled: enabled && idsProntos && uniqueIds.length > 0,
    staleTime: 30000,
  });
}
