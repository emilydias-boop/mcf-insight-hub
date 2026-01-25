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

    // Filter by trigger type
    const triggerFilter = triggerType === 'enter' ? 'stage_enter' : 'stage_exit';
    flowQuery = flowQuery.eq('trigger_on', triggerFilter);

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
        // Calculate scheduled time
        let scheduledAt = new Date(now);
        
        // Add delays
        if (step.delay_days) scheduledAt.setDate(scheduledAt.getDate() + step.delay_days);
        if (step.delay_hours) scheduledAt.setHours(scheduledAt.getHours() + step.delay_hours);
        if (step.delay_minutes) scheduledAt.setMinutes(scheduledAt.getMinutes() + step.delay_minutes);

        // Adjust for business hours if enabled
        if (flow.respect_business_hours) {
          scheduledAt = adjustToBusinessHours(
            scheduledAt,
            flow.business_hours_start || settingsMap.business_hours_start || '09:00',
            flow.business_hours_end || settingsMap.business_hours_end || '18:00',
            flow.exclude_weekends ?? settingsMap.exclude_weekends ?? true
          );
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
          console.log(`[AUTOMATION-ENQUEUE] Scheduled ${step.channel} for ${scheduledAt.toISOString()}`);
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
