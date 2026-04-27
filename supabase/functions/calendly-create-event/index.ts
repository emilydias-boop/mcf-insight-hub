import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateEventRequest {
  closerId: string;
  dealId: string;
  contactId?: string;
  scheduledAt: string;
  durationMinutes?: number;
  leadType?: string;
  notes?: string;
  sdrEmail?: string;
  alreadyBuilds?: boolean | null;
  parentAttendeeId?: string;
  bookedAt?: string; // Data real do agendamento (para retroativos)
  meetingType?: 'r1' | 'r2'; // Tipo da reunião para mover para estágio correto
}

// Google Calendar JWT authentication
async function createGoogleJWT(email: string, privateKey: string, scopes: string[]): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Encode header and claim
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${headerB64}.${claimB64}`;

  // Fix the private key format - handle both escaped \n and actual newlines
  let fixedPrivateKey = privateKey;

  // If the key has literal \n strings, replace them with actual newlines
  if (privateKey.includes("\\n")) {
    fixedPrivateKey = privateKey.replace(/\\n/g, "\n");
  }

  console.log("🔑 Private key starts with:", fixedPrivateKey.substring(0, 50));
  console.log("🔑 Private key contains BEGIN:", fixedPrivateKey.includes("BEGIN PRIVATE KEY"));

  // Import private key and sign
  const pemContent = fixedPrivateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/[\r\n\s]/g, "");

  console.log("🔑 PEM content length:", pemContent.length);

  // Use a safer base64 decode
  let binaryKey: Uint8Array;
  try {
    // Standard base64 decode
    binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  } catch (e) {
    console.error("❌ Failed to decode base64 key:", e);

    // Try URL-safe base64 decode
    const base64 = pemContent.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (base64.length % 4)) % 4;
    const paddedBase64 = base64 + "=".repeat(padding);
    binaryKey = Uint8Array.from(atob(paddedBase64), (c) => c.charCodeAt(0));
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(signatureInput));

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signatureInput}.${signatureB64}`;
}

async function getGoogleAccessToken(jwt: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Google access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventData: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    attendees: { email: string; displayName?: string }[];
  },
): Promise<{ eventId: string; meetLink: string; htmlLink: string; usedFallback: boolean }> {
  // Helper to build event payload
  const buildEventPayload = (includeAttendees: boolean, includeConference: boolean = true) => {
    const payload: any = {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.start.toISOString(),
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: eventData.end.toISOString(),
        timeZone: "America/Sao_Paulo",
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 30 }],
      },
    };

    if (includeAttendees && eventData.attendees.length > 0) {
      payload.attendees = eventData.attendees.map((a) => ({
        email: a.email,
        displayName: a.displayName,
      }));
    }

    if (includeConference) {
      payload.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      };
    }

    return payload;
  };

  // Try with attendees first
  console.log("📤 Attempting to create event with attendees...");
  const sendUpdatesParam = eventData.attendees.length > 0 ? "all" : "none";

  let response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=${sendUpdatesParam}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildEventPayload(true)),
    },
  );

  // Check for forbiddenForServiceAccounts error and retry without attendees
  if (!response.ok) {
    const errorText = await response.text();
    console.warn("⚠️ Google Calendar API error (first attempt):", errorText);

    // Check if it's the service account attendees restriction
    if (
      errorText.includes("forbiddenForServiceAccounts") ||
      errorText.includes("Service accounts cannot invite attendees")
    ) {
      console.log("🔄 Retrying without attendees (fallback mode)...");

      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildEventPayload(false, true)),
        },
      );

      if (!response.ok) {
        const fallbackError = await response.text();
        console.warn("⚠️ Google Calendar API error (fallback with conference):", fallbackError);

        // Check if it's a conference creation issue - try without conference
        if (fallbackError.includes("Invalid conference type") || fallbackError.includes("conferenceData")) {
          console.log("🔄 Retrying without conference (simple event)...");

          response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(buildEventPayload(false, false)),
            },
          );

          if (!response.ok) {
            const simpleError = await response.text();
            console.error("❌ Google Calendar API error (simple event):", simpleError);
            throw new Error(`Failed to create Google Calendar event: ${simpleError}`);
          }

          const createdEvent = await response.json();
          console.log("✅ Event created via fallback (simple event, no conference)");

          return {
            eventId: createdEvent.id,
            meetLink: "", // No meet link available
            htmlLink: createdEvent.htmlLink,
            usedFallback: true,
          };
        }

        console.error("❌ Google Calendar API error (fallback):", fallbackError);
        throw new Error(`Failed to create Google Calendar event: ${fallbackError}`);
      }

      const createdEvent = await response.json();
      const meetLink =
        createdEvent.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri || "";

      console.log("✅ Event created via fallback (without attendees/invites)");

      return {
        eventId: createdEvent.id,
        meetLink,
        htmlLink: createdEvent.htmlLink,
        usedFallback: true,
      };
    }

    // Check if it's a conference creation issue on first attempt
    if (errorText.includes("Invalid conference type") || errorText.includes("conferenceData")) {
      console.log("🔄 Retrying without conference (simple event)...");

      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildEventPayload(false, false)),
        },
      );

      if (!response.ok) {
        const simpleError = await response.text();
        console.error("❌ Google Calendar API error (simple event):", simpleError);
        throw new Error(`Failed to create Google Calendar event: ${simpleError}`);
      }

      const createdEvent = await response.json();
      console.log("✅ Event created via fallback (simple event, no conference)");

      return {
        eventId: createdEvent.id,
        meetLink: "",
        htmlLink: createdEvent.htmlLink,
        usedFallback: true,
      };
    }

    // Other error - throw
    throw new Error(`Failed to create Google Calendar event: ${errorText}`);
  }

  const createdEvent = await response.json();

  // Extract Google Meet link from conference data
  const meetLink = createdEvent.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri || "";

  return {
    eventId: createdEvent.id,
    meetLink,
    htmlLink: createdEvent.htmlLink,
    usedFallback: false,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleServiceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const googleServiceAccountPrivateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");

    console.log("🔐 Google Calendar configured:", !!googleServiceAccountEmail && !!googleServiceAccountPrivateKey);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateEventRequest = await req.json();
    const { closerId, dealId, contactId, scheduledAt, durationMinutes = 60, leadType = "A", notes } = body;

    console.log("📅 Creating meeting:", { closerId, dealId, scheduledAt, leadType });

    console.log("📅 Proceeding with meeting creation...");

    // Get closer info
    const { data: closer, error: closerError } = await supabase
      .from("closers")
      .select("id, name, email, google_calendar_id, google_calendar_enabled")
      .eq("id", closerId)
      .single();

    if (closerError || !closer) {
      console.error("❌ Closer not found:", closerError);
      return new Response(JSON.stringify({ error: "Closer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("👤 Closer:", {
      name: closer.name,
      google_calendar_enabled: closer.google_calendar_enabled,
      google_calendar_id: closer.google_calendar_id,
    });

    // Get deal info with custom_fields for fallback data
    const { data: deal } = await supabase
      .from("crm_deals")
      .select("name, contact_id, custom_fields, owner_id")
      .eq("id", dealId)
      .single();

    // Get contact info - try multiple sources
    let contactInfo = { name: "", email: "", phone: "" };
    let resolvedContactId = contactId || deal?.contact_id;

    if (resolvedContactId) {
      const { data: contact } = await supabase
        .from("crm_contacts")
        .select("name, email, phone")
        .eq("id", resolvedContactId)
        .single();

      if (contact) {
        contactInfo = contact;
      }
    }

    // Fallback: extract from deal.custom_fields or deal.name if contact info is empty
    if (!contactInfo.name && deal) {
      const customFields = deal.custom_fields as Record<string, any> | null;

      // Try to get name from custom_fields or deal name
      contactInfo.name = customFields?.nome || customFields?.name || deal.name || "";

      // Try to get phone from custom_fields
      if (!contactInfo.phone && customFields?.telefone) {
        contactInfo.phone = customFields.telefone;
      }
      if (!contactInfo.phone && customFields?.phone) {
        contactInfo.phone = customFields.phone;
      }
      if (!contactInfo.phone && customFields?.celular) {
        contactInfo.phone = customFields.celular;
      }

      // Try to get email from custom_fields
      if (!contactInfo.email && customFields?.email) {
        contactInfo.email = customFields.email;
      }

      console.log("📋 Using fallback contact info from deal:", {
        name: contactInfo.name,
        phone: contactInfo.phone ? "***" : "N/A",
        source: "custom_fields/deal.name",
      });
    }

    console.log("📋 Contact info:", { name: contactInfo.name, email: contactInfo.email });

    const scheduledDate = new Date(scheduledAt);
    const endDate = new Date(scheduledDate.getTime() + durationMinutes * 60000);

    // ============= DUPLICATE BOOKING & TERMINAL STATE GUARD =============
    // Bloqueia agendar lead que já tem reunião futura ativa do mesmo tipo
    // ou que já fechou contrato.
    const guardMeetingType: 'r1' | 'r2' = body.meetingType === 'r2' ? 'r2' : 'r1';

    // Detecta BU do deal pela origem — Consórcio é exceção dos guards de
    // contrato pago/won (ver memória `consorcio-week-and-revenue-attribution`
    // e o ajuste paralelo no front em `useAgendaData.ts`/`QuickScheduleModal`).
    let isConsorcioDeal = false;
    try {
      const { data: dealOriginRow } = await supabase
        .from("crm_deals")
        .select("origin_id")
        .eq("id", dealId)
        .maybeSingle();
      const originId = dealOriginRow?.origin_id ?? null;
      if (originId) {
        const { data: buMap } = await supabase
          .from("bu_origin_mapping")
          .select("bu")
          .eq("entity_type", "origin")
          .eq("entity_id", originId)
          .maybeSingle();
        isConsorcioDeal = (buMap?.bu ?? "").toLowerCase() === "consorcio";
      }
    } catch (e) {
      console.warn("⚠️ Falha ao detectar BU do deal — assumindo non-consorcio", e);
    }
    if (isConsorcioDeal) {
      console.log("🟢 Deal pertence à BU Consórcio — guards de contract_paid/won serão ignorados");
    }

    // R2 não aplica os guards de contrato pago / won / duplicate. R2 pode
    // acontecer pós-venda (acompanhamento) ou ser remarcada livremente.
    // Apenas R1 mantém o bloqueio rígido — exceto para Consórcio, onde o
    // mesmo lead pode ter múltiplos contratos/agendamentos ao longo do tempo.
    if (guardMeetingType === 'r1' && !isConsorcioDeal) {
    // 1) Deal já vendido (status won via crm_deals.status, se existir)
    const { data: dealStatusRow } = await supabase
      .from("crm_deals")
      .select("id, stage:crm_stages(stage_name)")
      .eq("id", dealId)
      .maybeSingle();

    const stageNameLower = (
      (dealStatusRow?.stage as any)?.stage_name || ""
    )
      .toString()
      .toLowerCase();
    const isWonStage =
      stageNameLower.includes("contrato pago") ||
      stageNameLower.includes("venda realizada") ||
      stageNameLower.includes("pagamento concluído") ||
      stageNameLower.includes("crédito contratado") ||
      stageNameLower.includes("crédito aprovado");

    if (isWonStage) {
      console.warn(`🚫 Deal already won (stage: ${stageNameLower})`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "deal_already_won",
          message:
            "Lead já fechou contrato — não é possível agendar nova reunião.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Contrato pago (qualquer attendee histórico)
    const { data: paidAttendee } = await supabase
      .from("meeting_slot_attendees")
      .select("id")
      .eq("deal_id", dealId)
      .or("status.eq.contract_paid,contract_paid_at.not.is.null")
      .limit(1)
      .maybeSingle();

    if (paidAttendee) {
      console.warn("🚫 Deal has contract_paid attendee");
      return new Response(
        JSON.stringify({
          success: false,
          error: "deal_already_paid",
          message:
            "Lead já tem contrato pago — não é possível agendar nova reunião.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Reunião futura ativa do MESMO meeting_type
    const nowIso = new Date().toISOString();
    const { data: activeFuture } = await supabase
      .from("meeting_slot_attendees")
      .select(
        `id, status,
         meeting_slot:meeting_slots!inner(id, scheduled_at, meeting_type, closer:closers(name))`
      )
      .eq("deal_id", dealId)
      .in("status", ["invited", "scheduled"])
      .eq("meeting_slot.meeting_type", guardMeetingType)
      .gt("meeting_slot.scheduled_at", nowIso)
      .limit(1);

    if (activeFuture && activeFuture.length > 0) {
      const slotInfo: any = (activeFuture[0] as any).meeting_slot;
      const closerName = Array.isArray(slotInfo?.closer)
        ? slotInfo.closer[0]?.name
        : slotInfo?.closer?.name;
      console.warn(
        `🚫 Duplicate active booking for deal ${dealId} (${guardMeetingType})`
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "duplicate_active_booking",
          message: `Lead já tem ${guardMeetingType.toUpperCase()} agendada${closerName ? ` com ${closerName}` : ""}. Use a Agenda para reagendar.`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    } // end if (guardMeetingType === 'r1') — fim dos guards 1, 2, 3

    // 4) R1 já realizada NÃO bloqueia mais o reagendamento.
    // A classificação "conta para SDR" vs "não conta" é feita pelo RPC de
    // métricas (regra ordinal: ordem 1 e 2 contam; 3+ não conta), permitindo
    // que o operacional resolva casos legítimos sem inflar métricas.
    // ============= END GUARD =============

    let meetingLink = "";
    let videoConferenceLink = "";
    let googleEventId = "";

    // ============= GOOGLE CALENDAR INTEGRATION =============
    if (
      closer.google_calendar_enabled &&
      googleServiceAccountEmail &&
      googleServiceAccountPrivateKey &&
      closer.google_calendar_id
    ) {
      console.log("🟢 Using Google Calendar to create event with Google Meet");

      try {
        // Create JWT and get access token
        const jwt = await createGoogleJWT(googleServiceAccountEmail, googleServiceAccountPrivateKey, [
          "https://www.googleapis.com/auth/calendar",
        ]);

        const accessToken = await getGoogleAccessToken(jwt);
        console.log("✅ Google access token obtained");

        // Build attendees list
        const attendees: { email: string; displayName?: string }[] = [];
        if (contactInfo.email) {
          attendees.push({ email: contactInfo.email, displayName: contactInfo.name });
        }
        attendees.push({ email: closer.email, displayName: closer.name });

        // Create event with Google Meet
        const googleEvent = await createGoogleCalendarEvent(accessToken, closer.google_calendar_id, {
          summary: `Reunião - ${contactInfo.name || deal?.name || "Lead"}`,
          description: `Lead Type: ${leadType}\n${notes || ""}\n\nAgendado via CRM`,
          start: scheduledDate,
          end: endDate,
          attendees,
        });

        videoConferenceLink = googleEvent.meetLink;
        meetingLink = googleEvent.htmlLink;
        googleEventId = googleEvent.eventId;

        console.log("✅ Google Calendar event created:", {
          eventId: googleEventId,
          meetLink: videoConferenceLink,
          htmlLink: meetingLink,
          usedFallback: googleEvent.usedFallback,
        });

        if (googleEvent.usedFallback) {
          console.log("⚠️ Note: Invites were NOT sent via Google (Service Account limitation)");
        }
      } catch (googleError) {
        console.error("❌ Google Calendar error:", googleError);
        console.log("⚠️ Continuing without Google Calendar integration");
        // Continue without Google Calendar - meeting will be created for tracking only
      }
    } else {
      console.log("ℹ️ Google Calendar not configured - creating meeting for tracking only");
      // Continue without Google Calendar - meeting will be created for tracking only
    }

    // Get booked_by - either from specified SDR email or current user
    const authHeader = req.headers.get("Authorization");
    let bookedBy = null;

    // First try to find by sdrEmail if provided
    if (body.sdrEmail) {
      const { data: sdrProfile } = await supabase.from("profiles").select("id").eq("email", body.sdrEmail).single();

      if (sdrProfile) {
        bookedBy = sdrProfile.id;
        console.log("📋 SDR atribuído:", body.sdrEmail);
      }
    }

    // Fallback to logged-in user if no SDR specified or not found
    if (!bookedBy && authHeader) {
      const {
        data: { user },
      } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      bookedBy = user?.id;
    }

    // Check if there's an existing slot at this time for this closer
    const { data: existingSlot } = await supabase
      .from("meeting_slots")
      .select("id, max_attendees")
      .eq("closer_id", closerId)
      .eq("scheduled_at", scheduledAt)
      .in("status", ["scheduled", "rescheduled"])
      .maybeSingle();

    // === CAPACITY VALIDATION (server-side) ===
    // Get max_leads for this closer at this time
    const slotDate = new Date(scheduledAt);
    const slotDayOfWeek = slotDate.getDay();
    const slotTimeStr = `${String(slotDate.getHours()).padStart(2, '0')}:${String(slotDate.getMinutes()).padStart(2, '0')}:00`;

    const [linkCapacity, closerCapacity] = await Promise.all([
      supabase
        .from("closer_meeting_links")
        .select("max_leads")
        .eq("closer_id", closerId)
        .eq("day_of_week", slotDayOfWeek)
        .eq("start_time", slotTimeStr)
        .maybeSingle(),
      supabase
        .from("closers")
        .select("max_leads_per_slot")
        .eq("id", closerId)
        .single(),
    ]);

    const maxLeads = linkCapacity.data?.max_leads ?? closerCapacity.data?.max_leads_per_slot ?? 4;

    if (existingSlot) {
      // Count current attendees
      const { count: currentAttendees } = await supabase
        .from("meeting_slot_attendees")
        .select("id", { count: "exact", head: true })
        .eq("meeting_slot_id", existingSlot.id);

      if ((currentAttendees ?? 0) >= maxLeads) {
        console.warn(`🚫 Slot full: ${currentAttendees}/${maxLeads} for closer ${closerId} at ${scheduledAt}`);
        return new Response(
          JSON.stringify({ success: false, error: "slot_full", message: `Horário lotado (${currentAttendees}/${maxLeads} leads)` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let slotId: string;

    if (existingSlot) {
      slotId = existingSlot.id;
      console.log("📍 Adding to existing slot:", slotId, `(${maxLeads} max leads)`);
    } else {
      // Create new slot
      const { data: newSlot, error: slotError } = await supabase
        .from("meeting_slots")
        .insert({
          closer_id: closerId,
          deal_id: dealId,
          contact_id: resolvedContactId || null,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          lead_type: leadType,
          status: "scheduled",
          meeting_link: meetingLink,
          video_conference_link: videoConferenceLink,
          google_event_id: googleEventId,
          booked_by: bookedBy,
          notes: notes || `Agendado via CRM\nLead Type: ${leadType}`,
        })
        .select("id")
        .single();

      if (slotError) {
        console.error("❌ Error creating slot:", slotError);
        return new Response(JSON.stringify({ error: "Failed to create slot", details: slotError }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      slotId = newSlot.id;
      console.log("✅ Created new slot:", slotId);
    }

    // Normalize notes: use provided notes or generate default
    const normalizedNotes = notes?.trim() || `Agendado via CRM\nLead Type: ${leadType}`;

    // Add attendee record with the same notes as the slot
    // Include attendee_name and attendee_phone even without contact_id for display purposes
    // Include parent_attendee_id if this is a reschedule/remanejamento
    // For retroactive bookings, use bookedAt if provided, otherwise use scheduledAt if it's in the past
    const now = new Date();
    let bookedAtValue: string | null = null;
    if (body.bookedAt) {
      bookedAtValue = body.bookedAt;
    } else if (scheduledDate < now) {
      // Retroactive: use scheduled date as booked date
      bookedAtValue = scheduledAt;
    }
    
    const { data: attendee, error: attendeeError } = await supabase
      .from("meeting_slot_attendees")
      .insert({
        meeting_slot_id: slotId,
        contact_id: resolvedContactId || null,
        deal_id: dealId,
        status: "invited",
        notes: normalizedNotes,
        booked_by: bookedBy,
        attendee_name: contactInfo.name || deal?.name || null,
        attendee_phone: contactInfo.phone || null,
        already_builds: body.alreadyBuilds ?? null,
        parent_attendee_id: body.parentAttendeeId || null,
        booked_at: bookedAtValue,
      })
      .select("id")
      .single();

    if (attendeeError) {
      console.error("⚠️ Error creating attendee:", attendeeError);
    } else {
      console.log("✅ Added attendee to slot", body.parentAttendeeId ? `(parent: ${body.parentAttendeeId})` : '');
    }

    // Mover deal para estágio "R1 Agendada" ou "R2 Agendada" automaticamente
    try {
      const meetingType = body.meetingType || 'r1';
      const stageNamesR1 = ['Reunião 01 Agendada', 'Reunião 1 Agendada', 'R1 Agendada'];
      const stageNamesR2 = ['Reunião 02 Agendada', 'Reunião 2 Agendada', 'R2 Agendada'];
      const stageNames = meetingType === 'r2' ? stageNamesR2 : stageNamesR1;
      
      // Buscar o deal para pegar origin_id e stage_id atual
      const { data: dealForStage } = await supabase
        .from('crm_deals')
        .select('origin_id, stage_id')
        .eq('id', dealId)
        .single();
      
      if (dealForStage?.origin_id) {
        let targetStageId: string | null = null;
        let targetStageName: string | null = null;
        let newOriginId = dealForStage.origin_id;
        
        // 1. Tentar encontrar estágio na pipeline atual
        for (const stageName of stageNames) {
          const { data: targetStage } = await supabase
            .from('crm_stages')
            .select('id, stage_name')
            .eq('origin_id', dealForStage.origin_id)
            .ilike('stage_name', `%${stageName}%`)
            .limit(1);
          
          if (targetStage?.[0]) {
            targetStageId = targetStage[0].id;
            targetStageName = targetStage[0].stage_name;
            break;
          }
        }
        
        // 2. FALLBACK: Se não encontrar na pipeline atual, buscar na PIPELINE INSIDE SALES
        if (!targetStageId) {
          console.log('⚠️ Stage not found in current pipeline, using INSIDE SALES fallback');
          
          const { data: insideSalesOrigin } = await supabase
            .from('crm_origins')
            .select('id')
            .eq('name', 'PIPELINE INSIDE SALES')
            .limit(1);
          
          if (insideSalesOrigin?.[0]) {
            for (const stageName of stageNames) {
              const { data: targetStage } = await supabase
                .from('crm_stages')
                .select('id, stage_name')
                .eq('origin_id', insideSalesOrigin[0].id)
                .ilike('stage_name', `%${stageName}%`)
                .limit(1);
              
              if (targetStage?.[0]) {
                targetStageId = targetStage[0].id;
                targetStageName = targetStage[0].stage_name;
                newOriginId = insideSalesOrigin[0].id;
                console.log(`📍 Found fallback stage in INSIDE SALES: ${targetStageName}`);
                break;
              }
            }
          }
        }
        
        // 3. Mover o deal (e mudar origin se necessário)
        // CORREÇÃO: Atualizar se stage diferente OU origin diferente
        const originChanged = newOriginId !== dealForStage.origin_id;
        const shouldUpdate = targetStageId && (targetStageId !== dealForStage.stage_id || originChanged);
        
        if (shouldUpdate && targetStageId) {
          const updateData: Record<string, string> = { stage_id: targetStageId! };
          
          if (originChanged) {
            updateData.origin_id = newOriginId;
            console.log(`📍 Movendo deal de origin ${dealForStage.origin_id} para INSIDE SALES (${newOriginId})`);
          }
          
          console.log(`📍 Movendo deal para stage: ${targetStageName} (stage_id: ${targetStageId})`);
          
          const { error: updateError } = await supabase
            .from('crm_deals')
            .update(updateData)
            .eq('id', dealId);
          
          if (updateError) {
            console.error('❌ Erro ao atualizar deal:', updateError.message);
          } else {
            // Registrar atividade de mudança de estágio
            await supabase.from('deal_activities').insert({
              deal_id: dealId,
              activity_type: 'stage_change',
              description: originChanged 
                ? `Movido automaticamente ao agendar ${meetingType.toUpperCase()} (pipeline alterada para INSIDE SALES)`
                : `Movido automaticamente ao agendar ${meetingType.toUpperCase()}`,
              from_stage: dealForStage.stage_id,
              to_stage: targetStageId,
              metadata: { 
                via: 'agenda_scheduling', 
                meeting_slot_id: slotId,
                origin_changed: originChanged,
                from_origin_id: originChanged ? dealForStage.origin_id : undefined,
                to_origin_id: originChanged ? newOriginId : undefined
              }
            });
            
            console.log(`✅ Deal movido para ${targetStageName}${originChanged ? ' (pipeline alterada)' : ''}`);
          }
        } else if (targetStageId) {
          console.log(`⏭️ Deal já está no estágio correto: ${targetStageName}`);
        } else {
          console.log('⚠️ Estágio de destino não encontrado em nenhuma pipeline');
        }
      }
    } catch (stageError) {
      console.error('⚠️ Error updating deal stage (non-fatal):', stageError);
      // Não falhar o agendamento se a mudança de estágio falhar
    }

    // Get the created slot with all relations
    const { data: slot } = await supabase
      .from("meeting_slots")
      .select(
        `
        *,
        closer:closers(*),
        contact:crm_contacts(*)
      `,
      )
      .eq("id", slotId)
      .single();

    console.log("✅ Meeting created successfully");

    return new Response(
      JSON.stringify({
        success: true,
        slotId,
        meetingLink: videoConferenceLink || meetingLink,
        videoConferenceLink,
        googleEventId,
        attendeeId: attendee?.id,
        slot,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    console.error("❌ Error in calendly-create-event:", error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
