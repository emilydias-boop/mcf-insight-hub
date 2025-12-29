import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format } from "https://esm.sh/date-fns@3.6.0";
import { ptBR } from "https://esm.sh/date-fns@3.6.0/locale";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID')!;
    const zapiToken = Deno.env.get('ZAPI_TOKEN')!;
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { meetingSlotId, resendAttendeeId } = await req.json();

    if (!meetingSlotId) {
      return new Response(JSON.stringify({ error: 'meetingSlotId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch meeting slot with closer
    const { data: meetingSlot, error: slotError } = await supabase
      .from('meeting_slots')
      .select(`
        id,
        scheduled_at,
        meeting_link,
        notes,
        closer_id
      `)
      .eq('id', meetingSlotId)
      .single();

    if (slotError || !meetingSlot) {
      console.error('Meeting slot not found:', slotError);
      return new Response(JSON.stringify({ error: 'Meeting slot not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch closer separately
    const { data: closer } = await supabase
      .from('closers')
      .select('id, name, email')
      .eq('id', meetingSlot.closer_id)
      .single();

    // Fetch attendees separately
    const { data: attendees } = await supabase
      .from('meeting_slot_attendees')
      .select('id, contact_id, deal_id, attendee_name, attendee_phone, is_partner, notified_at')
      .eq('meeting_slot_id', meetingSlotId);

    console.log('Meeting slot found:', JSON.stringify({ meetingSlot, closer, attendees }, null, 2));

    const closerName = closer?.name || 'Nosso Especialista';
    const scheduledDate = new Date(meetingSlot.scheduled_at);
    const formattedDate = format(scheduledDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
    const formattedTime = format(scheduledDate, 'HH:mm');
    const meetingLink = meetingSlot.meeting_link || '';

    // Z-API headers
    const zapiHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (zapiClientToken) {
      zapiHeaders['Client-Token'] = zapiClientToken;
    }

    const results: Array<{
      attendeeId: string;
      name: string;
      phone: string;
      success: boolean;
      error?: string;
    }> = [];

    // Process each attendee
    for (const attendee of attendees || []) {
      // If resendAttendeeId is specified, only send to that attendee
      if (resendAttendeeId && attendee.id !== resendAttendeeId) {
        continue;
      }

      // Skip if already notified (unless it's a resend)
      if (attendee.notified_at && !resendAttendeeId) {
        console.log(`Attendee ${attendee.id} already notified, skipping`);
        continue;
      }

      // Get phone and name from attendee or fetch from contact/deal
      let phone = attendee.attendee_phone;
      let name = attendee.attendee_name;

      if (!phone && attendee.contact_id) {
        const { data: contact } = await supabase
          .from('crm_contacts')
          .select('name, phone')
          .eq('id', attendee.contact_id)
          .single();
        if (contact) {
          phone = contact.phone;
          name = name || contact.name;
        }
      }

      if (!phone && attendee.deal_id) {
        const { data: deal } = await supabase
          .from('crm_deals')
          .select('contact_id')
          .eq('id', attendee.deal_id)
          .single();
        if (deal?.contact_id) {
          const { data: dealContact } = await supabase
            .from('crm_contacts')
            .select('name, phone')
            .eq('id', deal.contact_id)
            .single();
          if (dealContact) {
            phone = dealContact.phone;
            name = name || dealContact.name;
          }
        }
      }

      if (!phone) {
        console.log(`No phone for attendee ${attendee.id}, skipping`);
        results.push({
          attendeeId: attendee.id,
          name: name || 'Unknown',
          phone: 'N/A',
          success: false,
          error: 'No phone number',
        });
        continue;
      }

      // Clean phone number
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        console.log(`Invalid phone for attendee ${attendee.id}: ${cleanPhone}`);
        results.push({
          attendeeId: attendee.id,
          name: name || 'Unknown',
          phone: cleanPhone,
          success: false,
          error: 'Invalid phone number',
        });
        continue;
      }

      // Build personalized message
      const firstName = (name || 'Olá').split(' ')[0];
      const isPartner = attendee.is_partner;

      let message = '';
      if (isPartner) {
        message = `Olá ${firstName}! 👋

Você foi adicionado como participante em uma reunião.

📅 *${formattedDate}*
🕐 *${formattedTime}h*
👤 Com: ${closerName}`;
      } else {
        message = `Olá ${firstName}! 👋

Sua reunião foi agendada com sucesso!

📅 *${formattedDate}*
🕐 *${formattedTime}h*
👤 Com: ${closerName}`;
      }

      if (meetingLink) {
        message += `\n\n🔗 *Link da Reunião:*\n${meetingLink}`;
      }

      message += '\n\nNos vemos lá! 🚀';

      console.log(`Sending to ${cleanPhone}: ${message.substring(0, 100)}...`);

      try {
        // Send via Z-API
        const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;

        const zapiResponse = await fetch(zapiUrl, {
          method: 'POST',
          headers: zapiHeaders,
          body: JSON.stringify({
            phone: cleanPhone,
            message: message,
          }),
        });

        const zapiResult = await zapiResponse.json();
        console.log('Z-API response:', zapiResult);

        if (!zapiResponse.ok) {
          throw new Error(zapiResult.message || 'Z-API error');
        }

        // Update notified_at
        await supabase
          .from('meeting_slot_attendees')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', attendee.id);

        results.push({
          attendeeId: attendee.id,
          name: name || 'Unknown',
          phone: cleanPhone,
          success: true,
        });
      } catch (sendError) {
        console.error(`Failed to send to ${cleanPhone}:`, sendError);
        results.push({
          attendeeId: attendee.id,
          name: name || 'Unknown',
          phone: cleanPhone,
          success: false,
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Notification complete: ${successCount} sent, ${failCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: results.length,
        sent: successCount,
        failed: failCount,
      },
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Send meeting notification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
