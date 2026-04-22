// Meeting Reminders Cron — schedules and triggers AC tag-based reminders
// Runs every 5 minutes via pg_cron. Sends 6 reminder offsets per attendee.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Offsets in minutes from scheduled_at. Negative = before meeting.
const OFFSETS: Record<string, number> = {
  'd-1': 24 * 60,
  'h-4': 4 * 60,
  'h-2': 2 * 60,
  'h-1': 60,
  'm-20': 20,
  'm-0': 0,
};

const WINDOW_MINUTES = 5; // ±5 min tolerance

function formatPtBR(date: Date): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return {
    date: `${get('day')}/${get('month')}/${get('year')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const summary = { processed: 0, sent: 0, skipped: 0, failed: 0, details: [] as any[] };

  try {
    // 1. Load settings
    const { data: settings } = await supabase
      .from('meeting_reminder_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (!settings || !settings.is_active || !settings.ac_setup_confirmed) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'inactive_or_setup_pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const enabledOffsets: string[] = settings.enabled_offsets || [];
    const fallbackLink: string | null = settings.fallback_meeting_link || null;

    // 2. Load upcoming meetings (next 26h)
    const nowIso = new Date().toISOString();
    const horizonIso = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

    const { data: slots, error: slotsErr } = await supabase
      .from('meeting_slots')
      .select(`
        id, scheduled_at, status, closer_id, meeting_type, updated_at,
        meeting_slot_attendees!inner(
          id, status, deal_id,
          crm_deals!inner(
            id, name, owner_id, contact_id, bu_origem,
            crm_contacts(id, name, email, phone)
          )
        )
      `)
      .gte('scheduled_at', nowIso)
      .lte('scheduled_at', horizonIso)
      .in('status', ['scheduled', 'rescheduled']);

    if (slotsErr) throw slotsErr;
    if (!slots || slots.length === 0) {
      return new Response(
        JSON.stringify({ ...summary, message: 'No upcoming meetings' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();

    for (const slot of slots) {
      const slotDate = new Date(slot.scheduled_at);
      const slotTime = slotDate.getTime();
      const isR1 = slot.meeting_type === 'r1' || slot.meeting_type === 'R1' || !slot.meeting_type;
      const isR2 = slot.meeting_type === 'r2' || slot.meeting_type === 'R2';

      if (isR1 && !settings.apply_to_r1) continue;
      if (isR2 && !settings.apply_to_r2) continue;

      const attendees = (slot as any).meeting_slot_attendees || [];
      for (const attendee of attendees) {
        if (!['invited', 'scheduled'].includes(attendee.status)) continue;
        const deal = attendee.crm_deals;
        if (!deal) continue;
        const contact = deal.crm_contacts;

        // Reschedule cleanup: if slot updated after any prior log, drop logs older than (scheduled_at - 26h)
        // (lightweight: only do this once per slot per cron run)

        for (const offsetKey of enabledOffsets) {
          const offsetMin = OFFSETS[offsetKey];
          if (offsetMin === undefined) continue;

          const targetTime = slotTime - offsetMin * 60 * 1000;
          const deltaMin = Math.abs(now - targetTime) / 60000;
          if (deltaMin > WINDOW_MINUTES) continue;

          summary.processed++;

          // Dedupe check
          const { data: existing } = await supabase
            .from('meeting_reminders_log')
            .select('id')
            .eq('attendee_id', attendee.id)
            .eq('offset_key', offsetKey)
            .maybeSingle();

          if (existing) {
            summary.skipped++;
            continue;
          }

          const meetingType = isR2 ? 'R2' : 'R1';
          const baseLog = {
            meeting_slot_id: slot.id,
            attendee_id: attendee.id,
            offset_key: offsetKey,
            meeting_type: meetingType,
            scheduled_at: slot.scheduled_at,
          };

          // No email
          if (!contact?.email) {
            await supabase.from('meeting_reminders_log').insert({
              ...baseLog,
              contact_email: contact?.email || 'unknown',
              status: 'skipped',
              skip_reason: 'no_email',
            });
            summary.skipped++;
            continue;
          }

          // Blacklist check
          const { data: blacklisted } = await supabase
            .from('automation_blacklist')
            .select('id')
            .or(`email.eq.${contact.email},contact_id.eq.${contact.id}`)
            .limit(1)
            .maybeSingle();

          if (blacklisted) {
            await supabase.from('meeting_reminders_log').insert({
              ...baseLog,
              contact_email: contact.email,
              status: 'skipped',
              skip_reason: 'blacklisted',
            });
            summary.skipped++;
            continue;
          }

          // Resolve meeting link
          let meetingLink: string | null = null;
          if (slot.closer_id) {
            const dayOfWeek = slotDate.getDay();
            const timeStr = slotDate.toISOString().substring(11, 19);
            const { data: linkRow } = await supabase
              .from('closer_meeting_links')
              .select('google_meet_link')
              .eq('closer_id', slot.closer_id)
              .eq('day_of_week', dayOfWeek)
              .eq('start_time', timeStr)
              .maybeSingle();
            meetingLink = linkRow?.google_meet_link || null;
          }
          if (!meetingLink) meetingLink = fallbackLink;

          if (!meetingLink) {
            await supabase.from('meeting_reminders_log').insert({
              ...baseLog,
              contact_email: contact.email,
              status: 'skipped',
              skip_reason: 'no_link',
            });
            summary.skipped++;
            continue;
          }

          // Resolve closer / sdr / owner names
          let closerName = '';
          let sdrName = '';
          let whatsappOwner = '';

          if (slot.closer_id) {
            const { data: closerProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', slot.closer_id)
              .maybeSingle();
            closerName = closerProfile?.full_name || '';
          }

          if (deal.owner_id) {
            const { data: ownerProfile } = await supabase
              .from('profiles')
              .select('full_name, phone')
              .eq('id', deal.owner_id)
              .maybeSingle();
            sdrName = ownerProfile?.full_name || '';
            whatsappOwner = ownerProfile?.phone || '';
          }

          const { date: meetingDate, time: meetingTime } = formatPtBR(slotDate);

          // Invoke activecampaign-send
          try {
            const acRes = await supabase.functions.invoke('activecampaign-send', {
              body: {
                mode: 'sync_with_tag',
                email: contact.email,
                name: contact.name || deal.name || 'Lead',
                tag: `reminder_${offsetKey}`,
                listId: settings.ac_list_id || undefined,
                customFields: {
                  meeting_link: meetingLink,
                  meeting_date: meetingDate,
                  meeting_time: meetingTime,
                  meeting_type: meetingType,
                  closer_name: closerName,
                  sdr_name: sdrName,
                  whatsapp_owner: whatsappOwner,
                  bu_name: deal.bu_origem || '',
                },
              },
            });

            if (acRes.error || !acRes.data?.success) {
              await supabase.from('meeting_reminders_log').insert({
                ...baseLog,
                contact_email: contact.email,
                status: 'failed',
                error_message: acRes.error?.message || JSON.stringify(acRes.data || {}),
              });
              summary.failed++;
            } else {
              await supabase.from('meeting_reminders_log').insert({
                ...baseLog,
                contact_email: contact.email,
                status: 'sent',
                ac_contact_id: String(acRes.data.contactId || ''),
              });
              summary.sent++;
            }
          } catch (e: any) {
            await supabase.from('meeting_reminders_log').insert({
              ...baseLog,
              contact_email: contact.email,
              status: 'failed',
              error_message: e.message,
            });
            summary.failed++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[MEETING-REMINDERS-CRON] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
