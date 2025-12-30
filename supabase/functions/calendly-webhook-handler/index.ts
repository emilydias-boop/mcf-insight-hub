import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, calendly-webhook-signature',
};

interface CalendlyPayload {
  event: string;
  created_at: string;
  created_by: string;
  payload: {
    cancel_url?: string;
    created_at: string;
    email: string;
    event: string;
    first_name?: string;
    last_name?: string;
    name: string;
    new_invitee?: string;
    old_invitee?: string;
    no_show?: {
      uri: string;
      created_at: string;
    };
    payment?: any;
    questions_and_answers?: Array<{
      answer: string;
      position: number;
      question: string;
    }>;
    reconfirmation?: any;
    reschedule_url?: string;
    rescheduled: boolean;
    routing_form_submission?: string;
    scheduled_event: {
      uri: string;
      name: string;
      status: string;
      start_time: string;
      end_time: string;
      event_type: string;
      location: {
        type: string;
        location?: string;
        join_url?: string;
      };
      invitees_counter: {
        total: number;
        active: number;
        limit: number;
      };
      created_at: string;
      updated_at: string;
      event_memberships: Array<{
        user: string;
        user_email: string;
        user_name: string;
      }>;
      event_guests: any[];
    };
    status: string;
    text_reminder_number?: string;
    timezone: string;
    tracking: {
      utm_campaign?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_content?: string;
      utm_term?: string;
      salesforce_uuid?: string;
    };
    updated_at: string;
    uri: string;
    canceled?: boolean;
    cancellation?: {
      canceled_by: string;
      reason?: string;
      canceler_type: string;
      created_at: string;
    };
  };
}

// Verify webhook signature using HMAC-SHA256
async function verifyWebhookSignature(
  payload: string,
  signature: string,
  signingKey: string
): Promise<boolean> {
  try {
    // Signature format: t=timestamp,v1=signature
    const parts = signature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));
    
    if (!timestampPart || !signaturePart) {
      console.log('Missing timestamp or signature parts');
      return false;
    }
    
    const timestamp = timestampPart.substring(2);
    const expectedSignature = signaturePart.substring(3);
    
    // Create signed payload
    const signedPayload = `${timestamp}.${payload}`;
    
    // Create HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    );
    
    // Convert to hex
    const computedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return computedSignature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Detect lead type from event name or questions
function detectLeadType(eventName: string, questions?: Array<{ question: string; answer: string }>): string {
  const nameLower = eventName.toLowerCase();
  
  if (nameLower.includes('lead a') || nameLower.includes('tipo a')) {
    return 'A';
  }
  if (nameLower.includes('lead b') || nameLower.includes('tipo b')) {
    return 'B';
  }
  
  // Check questions for lead type
  if (questions) {
    for (const qa of questions) {
      const answerLower = qa.answer.toLowerCase();
      if (answerLower.includes('lead a') || answerLower === 'a') {
        return 'A';
      }
      if (answerLower.includes('lead b') || answerLower === 'b') {
        return 'B';
      }
    }
  }
  
  return 'A'; // Default to Lead A
}

// Extract phone from questions
function extractPhone(questions?: Array<{ question: string; answer: string }>): string | null {
  if (!questions) return null;
  
  for (const qa of questions) {
    const questionLower = qa.question.toLowerCase();
    if (questionLower.includes('telefone') || questionLower.includes('phone') || questionLower.includes('whatsapp') || questionLower.includes('celular')) {
      return qa.answer;
    }
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const signingKey = Deno.env.get('CALENDLY_WEBHOOK_SIGNING_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('calendly-webhook-signature');
    
    // Verify signature if signing key is configured
    if (signingKey && signature) {
      const isValid = await verifyWebhookSignature(rawBody, signature, signingKey);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Webhook signature verified successfully');
    } else {
      console.log('Skipping signature verification (no signing key or signature)');
    }
    
    const data: CalendlyPayload = JSON.parse(rawBody);
    console.log('Received Calendly webhook:', data.event);
    console.log('Payload:', JSON.stringify(data.payload, null, 2));
    
    const { event, payload } = data;
    
    switch (event) {
      case 'invitee.created': {
        console.log('Processing invitee.created event');
        
        // Extract data from payload
        const inviteeEmail = payload.email;
        const inviteeName = payload.name;
        const inviteeUri = payload.uri;
        const scheduledEvent = payload.scheduled_event;
        const eventUri = scheduledEvent.uri;
        const startTime = scheduledEvent.start_time;
        const endTime = scheduledEvent.end_time;
        const eventName = scheduledEvent.name;
        // Video conference link (Google Meet/Zoom) from the scheduled event location
        const videoConferenceLink = scheduledEvent.location?.join_url || null;
        const meetingLink = scheduledEvent.location?.join_url || null;
        const phone = extractPhone(payload.questions_and_answers);
        
        // Get closer from event memberships
        const membership = scheduledEvent.event_memberships?.[0];
        const closerEmail = membership?.user_email;
        
        // Detect lead type
        const leadType = detectLeadType(eventName, payload.questions_and_answers);
        
        // Calculate duration in minutes
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
        
        // Find or create contact
        let contactId = null;
        if (inviteeEmail) {
          // Try to find existing contact by email
          const { data: existingContact } = await supabase
            .from('crm_contacts')
            .select('id')
            .eq('email', inviteeEmail)
            .maybeSingle();
          
          if (existingContact) {
            contactId = existingContact.id;
            console.log('Found existing contact:', contactId);
          } else {
            // Create new contact
            const { data: newContact, error: contactError } = await supabase
              .from('crm_contacts')
              .insert({
                clint_id: `calendly_${inviteeUri.split('/').pop()}`,
                name: inviteeName,
                email: inviteeEmail,
                phone: phone,
                tags: [`Lead ${leadType}`, 'Calendly'],
              })
              .select('id')
              .single();
            
            if (contactError) {
              console.error('Error creating contact:', contactError);
            } else {
              contactId = newContact.id;
              console.log('Created new contact:', contactId);
            }
          }
        }
        
        // Find closer by email
        let closerId = null;
        if (closerEmail) {
          const { data: closer } = await supabase
            .from('closers')
            .select('id')
            .eq('email', closerEmail)
            .eq('is_active', true)
            .maybeSingle();
          
          if (closer) {
            closerId = closer.id;
            console.log('Found closer:', closerId);
          } else {
            console.log('Closer not found for email:', closerEmail);
            // Get first active closer as fallback
            const { data: fallbackCloser } = await supabase
              .from('closers')
              .select('id')
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            
            if (fallbackCloser) {
              closerId = fallbackCloser.id;
              console.log('Using fallback closer:', closerId);
            }
          }
        }
        
        if (!closerId) {
          console.error('No closer available');
          return new Response(
            JSON.stringify({ error: 'No closer available' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Check if there's already an existing slot at this time (for multi-lead support)
        const { data: existingSlot } = await supabase
          .from('meeting_slots')
          .select('id, max_attendees')
          .eq('closer_id', closerId)
          .eq('scheduled_at', startTime)
          .in('status', ['scheduled', 'rescheduled'])
          .maybeSingle();
        
        let slotId: string;
        
        if (existingSlot) {
          // Check attendee count
          const { count } = await supabase
            .from('meeting_slot_attendees')
            .select('id', { count: 'exact', head: true })
            .eq('meeting_slot_id', existingSlot.id);
          
          const currentAttendees = count || 0;
          const maxAttendees = existingSlot.max_attendees || 3;
          
          if (currentAttendees >= maxAttendees) {
            console.log('Slot is full:', existingSlot.id);
            return new Response(
              JSON.stringify({ error: 'Slot is full', maxAttendees, currentAttendees }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          slotId = existingSlot.id;
          console.log('Adding attendee to existing slot:', slotId);
          
          // Update meeting link and video conference link if not set
          if (meetingLink || videoConferenceLink) {
            const updateData: Record<string, string> = {};
            if (meetingLink) updateData.meeting_link = meetingLink;
            if (videoConferenceLink) updateData.video_conference_link = videoConferenceLink;
            
            await supabase
              .from('meeting_slots')
              .update(updateData)
              .eq('id', slotId);
            
            console.log('Updated slot with video conference link:', videoConferenceLink);
          }
        } else {
          // Create new meeting slot
          const { data: newSlot, error: slotError } = await supabase
            .from('meeting_slots')
            .insert({
              closer_id: closerId,
              contact_id: contactId,
              scheduled_at: startTime,
              duration_minutes: durationMinutes,
              lead_type: leadType,
              status: 'scheduled',
              meeting_link: meetingLink,
              video_conference_link: videoConferenceLink,
              notes: `Agendamento via Calendly\nEvento: ${eventName}\nTimezone: ${payload.timezone}`,
              calendly_event_uri: eventUri,
              calendly_invitee_uri: inviteeUri,
              max_attendees: 3,
            })
            .select('id')
            .single();
          
          if (slotError) {
            console.error('Error creating meeting slot:', slotError);
            return new Response(
              JSON.stringify({ error: 'Failed to create meeting slot', details: slotError }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          slotId = newSlot.id;
          console.log('Created new meeting slot:', slotId);
        }
        
        // Add attendee record
        const { data: attendee, error: attendeeError } = await supabase
          .from('meeting_slot_attendees')
          .insert({
            meeting_slot_id: slotId,
            contact_id: contactId,
            calendly_invitee_uri: inviteeUri,
            status: 'confirmed',
          })
          .select('id')
          .single();
        
        if (attendeeError) {
          console.error('Error creating attendee:', attendeeError);
        } else {
          console.log('Created attendee:', attendee.id);
        }
        
        return new Response(
          JSON.stringify({ success: true, slotId, attendeeId: attendee?.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'invitee.canceled': {
        console.log('Processing invitee.canceled event');
        
        const inviteeUri = payload.uri;
        
        // First try to find attendee by calendly_invitee_uri
        const { data: attendee } = await supabase
          .from('meeting_slot_attendees')
          .select('id, meeting_slot_id')
          .eq('calendly_invitee_uri', inviteeUri)
          .maybeSingle();
        
        if (attendee) {
          // Update attendee status
          await supabase
            .from('meeting_slot_attendees')
            .update({ status: 'canceled' })
            .eq('id', attendee.id);
          
          console.log('Canceled attendee:', attendee.id);
          
          // Check if all attendees are canceled
          const { count: activeCount } = await supabase
            .from('meeting_slot_attendees')
            .select('id', { count: 'exact', head: true })
            .eq('meeting_slot_id', attendee.meeting_slot_id)
            .neq('status', 'canceled');
          
          if (activeCount === 0) {
            // Cancel the entire slot if no active attendees
            await supabase
              .from('meeting_slots')
              .update({ status: 'canceled' })
              .eq('id', attendee.meeting_slot_id);
            
            console.log('Canceled meeting slot (no active attendees):', attendee.meeting_slot_id);
          }
          
          return new Response(
            JSON.stringify({ success: true, attendeeId: attendee.id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Fallback: try to find by meeting slot calendly_invitee_uri
        const { data: meeting } = await supabase
          .from('meeting_slots')
          .select('id')
          .eq('calendly_invitee_uri', inviteeUri)
          .maybeSingle();
        
        if (meeting) {
          await supabase
            .from('meeting_slots')
            .update({ status: 'canceled' })
            .eq('id', meeting.id);
          
          console.log('Canceled meeting slot:', meeting.id);
        } else {
          console.log('Meeting not found for invitee URI:', inviteeUri);
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'invitee.no_show': {
        console.log('Processing invitee.no_show event');
        
        const inviteeUri = payload.uri;
        
        // First try to find attendee by calendly_invitee_uri
        const { data: attendee } = await supabase
          .from('meeting_slot_attendees')
          .select('id, meeting_slot_id')
          .eq('calendly_invitee_uri', inviteeUri)
          .maybeSingle();
        
        if (attendee) {
          // Update attendee status
          await supabase
            .from('meeting_slot_attendees')
            .update({ status: 'no_show' })
            .eq('id', attendee.id);
          
          console.log('Marked attendee as no_show:', attendee.id);
          
          // Check if all attendees are no_show
          const { count: showedUp } = await supabase
            .from('meeting_slot_attendees')
            .select('id', { count: 'exact', head: true })
            .eq('meeting_slot_id', attendee.meeting_slot_id)
            .in('status', ['confirmed', 'invited']);
          
          if (showedUp === 0) {
            // Mark the entire slot as no_show if no one showed up
            await supabase
              .from('meeting_slots')
              .update({ status: 'no_show' })
              .eq('id', attendee.meeting_slot_id);
            
            console.log('Marked meeting slot as no_show:', attendee.meeting_slot_id);
          }
          
          return new Response(
            JSON.stringify({ success: true, attendeeId: attendee.id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Fallback: try to find by meeting slot calendly_invitee_uri
        const { data: meeting } = await supabase
          .from('meeting_slots')
          .select('id')
          .eq('calendly_invitee_uri', inviteeUri)
          .maybeSingle();
        
        if (meeting) {
          await supabase
            .from('meeting_slots')
            .update({ status: 'no_show' })
            .eq('id', meeting.id);
          
          console.log('Marked meeting slot as no_show:', meeting.id);
        } else {
          console.log('Meeting not found for invitee URI:', inviteeUri);
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      default:
        console.log('Unhandled event type:', event);
        return new Response(
          JSON.stringify({ success: true, message: 'Event type not handled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
