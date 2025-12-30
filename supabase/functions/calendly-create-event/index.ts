import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateEventRequest {
  closerId: string;
  dealId: string;
  contactId?: string;
  scheduledAt: string;
  durationMinutes?: number;
  leadType?: string;
  notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const calendlyToken = Deno.env.get('CALENDLY_PERSONAL_ACCESS_TOKEN');

    console.log('🔐 Calendly token configured:', !!calendlyToken);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body: CreateEventRequest = await req.json();
    const { closerId, dealId, contactId, scheduledAt, durationMinutes = 60, leadType = 'A', notes } = body;

    console.log('📅 Creating meeting:', { closerId, dealId, scheduledAt, leadType });

    // Get closer info
    const { data: closer, error: closerError } = await supabase
      .from('closers')
      .select('id, name, email, calendly_event_type_uri, calendly_default_link')
      .eq('id', closerId)
      .single();

    if (closerError || !closer) {
      console.error('❌ Closer not found:', closerError);
      return new Response(
        JSON.stringify({ error: 'Closer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 Closer:', { 
      name: closer.name, 
      calendly_event_type_uri: closer.calendly_event_type_uri?.substring(0, 50),
      calendly_default_link: closer.calendly_default_link?.substring(0, 50)
    });

    // Get contact info
    let contactInfo = { name: '', email: '', phone: '' };
    if (contactId) {
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('name, email, phone')
        .eq('id', contactId)
        .single();
      
      if (contact) {
        contactInfo = contact;
      }
    }

    // Get deal info
    const { data: deal } = await supabase
      .from('crm_deals')
      .select('name, contact_id')
      .eq('id', dealId)
      .single();

    // If no contactId provided, try to get from deal
    if (!contactId && deal?.contact_id) {
      const { data: dealContact } = await supabase
        .from('crm_contacts')
        .select('name, email, phone')
        .eq('id', deal.contact_id)
        .single();
      
      if (dealContact) {
        contactInfo = dealContact;
      }
    }

    console.log('📋 Contact info:', { name: contactInfo.name, email: contactInfo.email });

    const scheduledDate = new Date(scheduledAt);
    const endDate = new Date(scheduledDate.getTime() + durationMinutes * 60000);

    let meetingLink = '';
    let calendlyEventUri = '';
    let videoConferenceLink = '';

    // Try to create Calendly event via API
    // NOTE: Calendly's public API does NOT support creating scheduled events directly via POST
    // The POST /scheduled_events endpoint does not exist - we need to use webhooks or pre-filled links
    // For now, we'll use the pre-filled link approach and explain this limitation
    
    if (calendlyToken && closer.calendly_event_type_uri) {
      console.log('🔵 Attempting Calendly API integration...');
      
      try {
        // First, let's verify the token works by getting user info
        const userResponse = await fetch('https://api.calendly.com/users/me', {
          headers: {
            'Authorization': `Bearer ${calendlyToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log('✅ Calendly API connected:', userData.resource?.name);
          
          // Get event type details to verify it exists and get location settings
          const eventTypeResponse = await fetch(closer.calendly_event_type_uri, {
            headers: {
              'Authorization': `Bearer ${calendlyToken}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (eventTypeResponse.ok) {
            const eventTypeData = await eventTypeResponse.json();
            console.log('📋 Event type found:', eventTypeData.resource?.name);
            console.log('📋 Event type location:', JSON.stringify(eventTypeData.resource?.location));
            
            // Extract scheduling URL from event type
            const schedulingUrl = eventTypeData.resource?.scheduling_url;
            if (schedulingUrl) {
              // Build pre-filled link with date/time
              const dateFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Sao_Paulo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              });
              const timeFormatter = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });
              
              const dateStr = dateFormatter.format(scheduledDate);
              const timeStr = timeFormatter.format(scheduledDate);
              
              const separator = schedulingUrl.includes('?') ? '&' : '?';
              meetingLink = `${schedulingUrl}${separator}date=${dateStr}&time=${timeStr}`;
              
              if (contactInfo.name) {
                meetingLink += `&name=${encodeURIComponent(contactInfo.name)}`;
              }
              if (contactInfo.email) {
                meetingLink += `&email=${encodeURIComponent(contactInfo.email)}`;
              }
              
              console.log('📎 Generated Calendly link with pre-fill:', meetingLink);
            }
          } else {
            console.warn('⚠️ Could not fetch event type:', eventTypeResponse.status);
          }
        } else {
          console.warn('⚠️ Calendly API token invalid or expired:', userResponse.status);
        }
      } catch (apiError) {
        console.error('❌ Calendly API error:', apiError);
      }
    }

    // Fallback: Use calendly_default_link with date/time params
    if (!meetingLink && closer.calendly_default_link) {
      console.log('📎 Using calendly_default_link with pre-selected date/time');
      
      const dateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      const dateStr = dateFormatter.format(scheduledDate);
      const timeStr = timeFormatter.format(scheduledDate);
      
      const baseLink = closer.calendly_default_link;
      const separator = baseLink.includes('?') ? '&' : '?';
      meetingLink = `${baseLink}${separator}date=${dateStr}&time=${timeStr}`;
      
      if (contactInfo.name) {
        meetingLink += `&name=${encodeURIComponent(contactInfo.name)}`;
      }
      if (contactInfo.email) {
        meetingLink += `&email=${encodeURIComponent(contactInfo.email)}`;
      }
      
      console.log('📎 Generated fallback meeting link:', meetingLink);
    }

    if (!meetingLink) {
      console.log('⚠️ No Calendly configuration for closer, using internal scheduling only');
    }

    // Check if there's an existing slot at this time for this closer
    const { data: existingSlot } = await supabase
      .from('meeting_slots')
      .select('id, max_attendees')
      .eq('closer_id', closerId)
      .eq('scheduled_at', scheduledAt)
      .in('status', ['scheduled', 'rescheduled'])
      .maybeSingle();

    let slotId: string;

    if (existingSlot) {
      // Check attendees count
      const { count } = await supabase
        .from('meeting_slot_attendees')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_slot_id', existingSlot.id);

      const currentAttendees = count || 0;
      const maxAttendees = existingSlot.max_attendees || 3;

      if (currentAttendees >= maxAttendees) {
        return new Response(
          JSON.stringify({ error: 'Slot is full', maxAttendees, currentAttendees }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      slotId = existingSlot.id;
      console.log('📍 Adding to existing slot:', slotId);
    } else {
      // Get current user
      const authHeader = req.headers.get('Authorization');
      let bookedBy = null;
      
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        bookedBy = user?.id;
      }

      // Create new slot
      const { data: newSlot, error: slotError } = await supabase
        .from('meeting_slots')
        .insert({
          closer_id: closerId,
          deal_id: dealId,
          contact_id: contactId || deal?.contact_id,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          lead_type: leadType,
          status: 'scheduled',
          meeting_link: meetingLink || closer.calendly_default_link,
          video_conference_link: videoConferenceLink || null,
          calendly_event_uri: calendlyEventUri || null,
          booked_by: bookedBy,
          notes: notes || `Agendado via CRM\nLead Type: ${leadType}`,
          max_attendees: 3,
        })
        .select('id')
        .single();

      if (slotError) {
        console.error('❌ Error creating slot:', slotError);
        return new Response(
          JSON.stringify({ error: 'Failed to create slot', details: slotError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      slotId = newSlot.id;
      console.log('✅ Created new slot:', slotId);
    }

    // Add attendee record
    const { data: attendee, error: attendeeError } = await supabase
      .from('meeting_slot_attendees')
      .insert({
        meeting_slot_id: slotId,
        contact_id: contactId || deal?.contact_id,
        deal_id: dealId,
        status: 'invited',
      })
      .select('id')
      .single();

    if (attendeeError) {
      console.error('⚠️ Error creating attendee:', attendeeError);
    } else {
      console.log('✅ Added attendee to slot');
    }

    // Update deal stage to "Reunião 01 Agendada"
    const { data: stages } = await supabase
      .from('crm_stages')
      .select('id')
      .ilike('stage_name', '%Reunião 01 Agendada%')
      .limit(1);

    const stageId = stages?.[0]?.id;

    if (stageId) {
      await supabase
        .from('crm_deals')
        .update({
          stage_id: stageId,
          next_action_date: scheduledAt,
          next_action_type: 'meeting',
          next_action_note: `Reunião agendada com ${closer.name}`,
        })
        .eq('id', dealId);

      console.log('✅ Updated deal stage');

      // Log activity
      let userId = null;
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id;
      }

      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        activity_type: 'meeting_scheduled',
        description: `Reunião agendada para ${new Date(scheduledAt).toLocaleString('pt-BR')} com ${closer.name}`,
        user_id: userId,
        metadata: {
          closer_id: closerId,
          closer_name: closer.name,
          scheduled_at: scheduledAt,
          slot_id: slotId,
          meeting_link: meetingLink,
        },
      });
    }

    // Get full slot data to return
    const { data: slot } = await supabase
      .from('meeting_slots')
      .select('*, closers(*)')
      .eq('id', slotId)
      .single();

    console.log('✅ Meeting created successfully:', {
      slotId,
      meetingLink: meetingLink?.substring(0, 60) + '...',
      videoConferenceLink: videoConferenceLink || 'none (will be set by Calendly webhook)',
    });

    return new Response(
      JSON.stringify({
        success: true,
        slotId,
        meetingLink: slot?.meeting_link || meetingLink,
        videoConferenceLink: slot?.video_conference_link || videoConferenceLink,
        attendeeId: attendee?.id,
        slot,
        message: videoConferenceLink 
          ? 'Reunião criada com link direto de videoconferência'
          : 'Reunião agendada - quando o cliente confirmar no Calendly, o link será atualizado automaticamente',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Create event error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
