// Automation Enqueue - Schedules automation messages when deal changes stage
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnqueueRequest {
  dealId: string;
  contactId: string;
  newStageId: string;
  oldStageId?: string;
  originId?: string;
  triggerType: 'enter' | 'exit';
}

type AutomationAnchor = 'enqueue_time' | 'meeting_start' | 'meeting_end' | 'contract_paid_at';

const MIN_LEAD_TIME_MINUTES = 15;

/**
 * Detecta a âncora temporal a partir do nome do stage.
 * Regra simples (Onda 3):
 *  - "agendada/agendamento" de reunião → meeting_start (offset = -delay, antes da reunião)
 *  - "realizada" de reunião → meeting_end (offset = +delay, depois da reunião)
 *  - "contrato pago/fechado/convertido/parcela paga" → contract_paid_at (+delay)
 *  - default → enqueue_time (+delay, comportamento atual)
 */
function detectAnchorFromStage(stageName: string | null | undefined): {
  anchor: AutomationAnchor;
  direction: 'before' | 'after';
} {
  if (!stageName) return { anchor: 'enqueue_time', direction: 'after' };
  const s = stageName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // Reunião agendada (R1/R2/1ª/2ª)
  if (
    /\b(reuniao|consultoria)\s+agendad/.test(s) ||
    /\br[12]\s+agendad/.test(s) ||
    /\b(1a|2a|1°|2°|1\.|2\.)\s*reuniao\s+agendad/.test(s) ||
    /^agendamento$/.test(s)
  ) {
    return { anchor: 'meeting_start', direction: 'before' };
  }

  // Reunião realizada
  if (
    /\b(reuniao|consultoria)\s+realizad/.test(s) ||
    /\br[12]\s+realizad/.test(s) ||
    /\b(1a|2a|1°|2°)\s*reuniao\s+realizad/.test(s)
  ) {
    return { anchor: 'meeting_end', direction: 'after' };
  }

  // Pagamento / fechamento
  if (
    /contrato\s*pago/.test(s) ||
    /consorcio\s*fechado/.test(s) ||
    /^fechado$/.test(s) ||
    /^convertido$/.test(s) ||
    /1[°o]?\s*parcela\s*paga/.test(s)
  ) {
    return { anchor: 'contract_paid_at', direction: 'after' };
  }

  return { anchor: 'enqueue_time', direction: 'after' };
}

/**
 * Resolve o timestamp da âncora consultando o banco.
 * Retorna null se a âncora não estiver disponível (fallback para enqueue_time).
 */
async function resolveAnchorTime(
  supabase: any,
  dealId: string,
  anchor: AutomationAnchor
): Promise<Date | null> {
  if (anchor === 'enqueue_time') return null;

  if (anchor === 'meeting_start' || anchor === 'meeting_end') {
    // Pega o meeting_slot mais recente (não cancelado) do deal
    const { data: slot } = await supabase
      .from('meeting_slots')
      .select('scheduled_at, duration_minutes, status')
      .eq('deal_id', dealId)
      .not('status', 'in', '("cancelled","no_show","rescheduled")')
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!slot?.scheduled_at) return null;
    const start = new Date(slot.scheduled_at);
    if (anchor === 'meeting_end') {
      const dur = Number(slot.duration_minutes) || 60;
      return new Date(start.getTime() + dur * 60_000);
    }
    return start;
  }

  if (anchor === 'contract_paid_at') {
    // Procura contract_paid_at em meeting_slot_attendees para o deal
    const { data: slots } = await supabase
      .from('meeting_slots')
      .select('id')
      .eq('deal_id', dealId);
    const slotIds = (slots || []).map((s: any) => s.id);
    if (slotIds.length === 0) return null;
    const { data: attendees } = await supabase
      .from('meeting_slot_attendees')
      .select('contract_paid_at')
      .in('meeting_slot_id', slotIds)
      .not('contract_paid_at', 'is', null)
      .order('contract_paid_at', { ascending: false })
      .limit(1);
    const paidAt = attendees?.[0]?.contract_paid_at;
    return paidAt ? new Date(paidAt) : null;
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body: EnqueueRequest = await req.json();
    console.log('[AUTOMATION-ENQUEUE] Request:', JSON.stringify(body));

    const { dealId, contactId, newStageId, oldStageId, originId, triggerType } = body;

    if (!dealId || !newStageId) {
      throw new Error('Missing required fields: dealId, newStageId');
    }

    // 1. Cancel any pending automations for this deal from previous flows
    const { data: cancelledItems, error: cancelError } = await supabase
      .from('automation_queue')
      .update({ status: 'cancelled' })
      .eq('deal_id', dealId)
      .eq('status', 'pending')
      .select('id');

    if (cancelError) {
      console.error('[AUTOMATION-ENQUEUE] Error cancelling pending:', cancelError);
    } else if (cancelledItems?.length) {
      console.log(`[AUTOMATION-ENQUEUE] Cancelled ${cancelledItems.length} pending items`);
    }

    // 2. Find active flows for the new stage
    let flowQuery = supabase
      .from('automation_flows')
      .select(`
        id,
        name,
        trigger_on,
        respect_business_hours,
        business_hours_start,
        business_hours_end,
        exclude_weekends,
        origin_id,
        automation_steps (
          id,
          channel,
          template_id,
          delay_days,
          delay_hours,
          delay_minutes,
          order_index,
          is_active
        )
      `)
      .eq('stage_id', newStageId)
      .eq('is_active', true);

    // Filter by trigger type (enum automation_trigger has values 'enter' | 'exit')
    flowQuery = flowQuery.eq('trigger_on', triggerType);

    // Filter by origin if specified in flow
    if (originId) {
      flowQuery = flowQuery.or(`origin_id.is.null,origin_id.eq.${originId}`);
    } else {
      flowQuery = flowQuery.is('origin_id', null);
    }

    const { data: flows, error: flowsError } = await flowQuery;

    if (flowsError) {
      throw flowsError;
    }

    if (!flows || flows.length === 0) {
      console.log('[AUTOMATION-ENQUEUE] No active flows found for stage:', newStageId);
      return new Response(
        JSON.stringify({ success: true, enqueued: 0, message: 'No active flows for this stage' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AUTOMATION-ENQUEUE] Found ${flows.length} active flows`);

    // 2.1. Detectar âncora a partir do nome do stage (Onda 3)
    const { data: stageRow } = await supabase
      .from('crm_stages')
      .select('stage_name')
      .eq('id', newStageId)
      .maybeSingle();
    const stageName = stageRow?.stage_name || '';
    const detected = detectAnchorFromStage(stageName);
    const anchorTime = await resolveAnchorTime(supabase, dealId, detected.anchor);
    const effectiveAnchor: AutomationAnchor = anchorTime ? detected.anchor : 'enqueue_time';
    console.log(
      `[AUTOMATION-ENQUEUE] Stage="${stageName}" detected=${detected.anchor}/${detected.direction} ` +
      `anchorTime=${anchorTime?.toISOString() || 'null'} effective=${effectiveAnchor}`
    );

    // 3. Get automation settings
    const { data: settings } = await supabase
      .from('automation_settings')
      .select('key, value');

    const settingsMap: Record<string, any> = {};
    settings?.forEach(s => {
      settingsMap[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
    });

    // 4. Check if contact is in blacklist
    const { data: blacklisted } = await supabase
      .from('automation_blacklist')
      .select('id')
      .eq('contact_id', contactId)
      .maybeSingle();

    if (blacklisted) {
      console.log('[AUTOMATION-ENQUEUE] Contact is blacklisted, skipping');
      return new Response(
        JSON.stringify({ success: true, enqueued: 0, message: 'Contact is blacklisted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Enqueue steps for each flow
    const now = new Date();
    let totalEnqueued = 0;

    for (const flow of flows) {
      const steps = (flow.automation_steps || [])
        .filter((s: any) => s.is_active !== false)
        .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));

      if (steps.length === 0) {
        console.log(`[AUTOMATION-ENQUEUE] Flow ${flow.name} has no active steps`);
        continue;
      }

      for (const step of steps) {
        // Calcula offset total em minutos a partir dos campos de delay
        const delayMinutesTotal =
          (step.delay_days || 0) * 24 * 60 +
          (step.delay_hours || 0) * 60 +
          (step.delay_minutes || 0);

        let scheduledAt: Date;
        if (effectiveAnchor !== 'enqueue_time' && anchorTime) {
          // Onda 3: delay relativo à âncora. before = subtrai, after = soma.
          const signed = detected.direction === 'before' ? -delayMinutesTotal : delayMinutesTotal;
          scheduledAt = new Date(anchorTime.getTime() + signed * 60_000);
        } else {
          // Comportamento atual: a partir de "agora"
          scheduledAt = new Date(now.getTime() + delayMinutesTotal * 60_000);
        }

        // Adjust for business hours if enabled
        if (flow.respect_business_hours) {
          scheduledAt = adjustToBusinessHours(
            scheduledAt,
            flow.business_hours_start || settingsMap.business_hours_start || '09:00',
            flow.business_hours_end || settingsMap.business_hours_end || '18:00',
            flow.exclude_weekends ?? settingsMap.exclude_weekends ?? true
          );
        }

        // Salvaguarda min_lead_time: nunca agendar no passado / quase-passado
        const minLeadCutoff = new Date(now.getTime() + MIN_LEAD_TIME_MINUTES * 60_000);
        if (scheduledAt < minLeadCutoff) {
          console.log(
            `[AUTOMATION-ENQUEUE] Skipping step ${step.id}: scheduledAt ${scheduledAt.toISOString()} ` +
            `< minLead ${minLeadCutoff.toISOString()} (anchor=${effectiveAnchor})`
          );
          continue;
        }

        // Insert into queue
        const { error: insertError } = await supabase
          .from('automation_queue')
          .insert({
            deal_id: dealId,
            contact_id: contactId,
            flow_id: flow.id,
            step_id: step.id,
            scheduled_at: scheduledAt.toISOString(),
            status: 'pending'
          });

        if (insertError) {
          console.error(`[AUTOMATION-ENQUEUE] Error inserting queue item:`, insertError);
        } else {
          totalEnqueued++;
          console.log(
            `[AUTOMATION-ENQUEUE] Scheduled ${step.channel} for ${scheduledAt.toISOString()} ` +
            `(anchor=${effectiveAnchor}, delay=${delayMinutesTotal}min, dir=${detected.direction})`
          );
        }
      }
    }

    console.log(`[AUTOMATION-ENQUEUE] Total enqueued: ${totalEnqueued}`);

    return new Response(
      JSON.stringify({ success: true, enqueued: totalEnqueued }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AUTOMATION-ENQUEUE] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * Adjusts a date to fall within business hours
 */
function adjustToBusinessHours(
  date: Date,
  startTime: string,
  endTime: string,
  excludeWeekends: boolean
): Date {
  const adjusted = new Date(date);
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  // Skip to next business day if weekend
  if (excludeWeekends) {
    while (adjusted.getDay() === 0 || adjusted.getDay() === 6) {
      adjusted.setDate(adjusted.getDate() + 1);
      adjusted.setHours(startHour, startMinute, 0, 0);
    }
  }

  // Check if within business hours
  const currentHour = adjusted.getHours();
  const currentMinute = adjusted.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;

  if (currentTime < startTimeMinutes) {
    // Before business hours - set to start time
    adjusted.setHours(startHour, startMinute, 0, 0);
  } else if (currentTime >= endTimeMinutes) {
    // After business hours - set to next day start time
    adjusted.setDate(adjusted.getDate() + 1);
    adjusted.setHours(startHour, startMinute, 0, 0);
    
    // Skip weekend if needed
    if (excludeWeekends) {
      while (adjusted.getDay() === 0 || adjusted.getDay() === 6) {
        adjusted.setDate(adjusted.getDate() + 1);
      }
    }
  }

  return adjusted;
}
