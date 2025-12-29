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

    if (!calendlyToken) {
      console.error('CALENDLY_PERSONAL_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Calendly API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body: CreateEventRequest = await req.json();
    const { closerId, dealId, contactId, scheduledAt, durationMinutes = 60, leadType = 'A', notes } = body;

    console.log('Creating Calendly event:', body);

    // Get closer info with calendly_event_type_uri and default link
    const { data: closer, error: closerError } = await supabase
      .from('closers')
      .select('id, name, email, calendly_event_type_uri, calendly_default_link')
      .eq('id', closerId)
      .single();

    if (closerError || !closer) {
      console.error('Closer not found:', closerError);
      return new Response(
        JSON.stringify({ error: 'Closer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const scheduledDate = new Date(scheduledAt);
    const endDate = new Date(scheduledDate.getTime() + durationMinutes * 60000);

    let meetingLink = '';
    let calendlyEventUri = '';

    // Try to create Calendly event via API
    if (closer.calendly_event_type_uri) {
      try {
        // Get current user to use as organizer
        const calendlyResponse = await fetch('https://api.calendly.com/scheduled_events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${calendlyToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_type: closer.calendly_event_type_uri,
            start_time: scheduledDate.toISOString(),
            end_time: endDate.toISOString(),
            invitee: {
              email: contactInfo.email || `lead-${dealId.slice(0, 8)}@placeholder.com`,
              name: contactInfo.name || `Lead ${dealId.slice(0, 8)}`,
            },
          }),
        });

        if (calendlyResponse.ok) {
          const calendlyData = await calendlyResponse.json();
          meetingLink = calendlyData.resource?.location?.join_url || '';
          calendlyEventUri = calendlyData.resource?.uri || '';
          console.log('Calendly event created:', calendlyEventUri);
        } else {
          const errorText = await calendlyResponse.text();
          console.log('Calendly API error (will use fallback):', errorText);
          // Generate fallback link - will be updated by webhook
          meetingLink = `https://calendly.com/scheduled/${Date.now()}`;
        }
      } catch (apiError) {
        console.log('Calendly API call failed (will use fallback):', apiError);
        meetingLink = `https://calendly.com/scheduled/${Date.now()}`;
      }
    } else if (closer.calendly_default_link) {
      // No event type URI but has default link - use it with date/time params
      console.log('Using calendly_default_link with pre-selected date/time');
      
      // Format date and time for Calendly URL params
      const dateStr = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const hours = scheduledDate.getUTCHours().toString().padStart(2, '0');
      const minutes = scheduledDate.getUTCMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      
      const baseLink = closer.calendly_default_link;
      const separator = baseLink.includes('?') ? '&' : '?';
      meetingLink = `${baseLink}${separator}date=${dateStr}&time=${timeStr}`;
      
      console.log('Generated meeting link:', meetingLink);
    } else {
      // No event type or default link configured
      console.log('No Calendly configuration for closer, using internal scheduling');
      meetingLink = '';
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
      console.log('Adding to existing slot:', slotId);
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
          meeting_link: meetingLink,
          calendly_event_uri: calendlyEventUri,
          booked_by: bookedBy,
          notes: notes || `Agendado via CRM\nLead Type: ${leadType}`,
          max_attendees: 3,
        })
        .select('id')
        .single();

      if (slotError) {
        console.error('Error creating slot:', slotError);
        return new Response(
          JSON.stringify({ error: 'Failed to create slot', details: slotError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      slotId = newSlot.id;
      console.log('Created new slot:', slotId);
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
      console.error('Error creating attendee:', attendeeError);
      // Don't fail - slot was created successfully
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

      // Log activity
      const authHeader = req.headers.get('Authorization');
      let userId = null;
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

    return new Response(
      JSON.stringify({
        success: true,
        slotId,
        meetingLink: slot?.meeting_link || meetingLink,
        attendeeId: attendee?.id,
        slot,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Create event error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
