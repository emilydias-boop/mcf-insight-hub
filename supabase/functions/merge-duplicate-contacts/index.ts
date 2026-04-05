import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { dry_run = true, batch_size = 50 } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Find duplicate phone groups that have deals
    const { data: groups, error: groupsError } = await supabase.rpc(
      "get_duplicate_contact_phones",
      { limit_count: batch_size * 2 }
    );

    if (groupsError) throw groupsError;

    const results = {
      dry_run,
      grupos_processados: 0,
      deals_remapeados: 0,
      attendees_remapeados: 0,
      contatos_arquivados: 0,
      erros: [] as { grupo: string; erro: string }[],
    };

    // Process each phone_suffix group
    for (const group of (groups || [])) {
      if (results.grupos_processados >= batch_size) break;

      const phoneSuffix = group.phone_suffix;

      try {
        // Fetch all contacts in this group ordered by created_at ASC
        const { data: contacts, error: contactsErr } = await supabase
          .from("crm_contacts")
          .select("id, name, email, phone, created_at, is_archived")
          .filter("phone", "not.is", null)
          .order("created_at", { ascending: true });

        if (contactsErr) throw contactsErr;

        // Filter contacts matching this phone suffix
        const matching = (contacts || []).filter((c: any) => {
          const digits = (c.phone || "").replace(/\D/g, "");
          return digits.length >= 9 && digits.slice(-9) === phoneSuffix && !c.is_archived;
        });

        if (matching.length < 2) continue;

        // Check if any contact in the group has deals
        const contactIds = matching.map((c: any) => c.id);
        const { count: dealCount } = await supabase
          .from("crm_deals")
          .select("id", { count: "exact", head: true })
          .in("contact_id", contactIds);

        if (!dealCount || dealCount === 0) continue;

        const principalId = matching[0].id;
        const secondaryContacts = matching.slice(1);

        for (const secondary of secondaryContacts) {
          if (dry_run) {
            // Count what would be remapped
            const { count: dCount } = await supabase
              .from("crm_deals")
              .select("id", { count: "exact", head: true })
              .eq("contact_id", secondary.id);

            const { count: aCount } = await supabase
              .from("meeting_slot_attendees")
              .select("id", { count: "exact", head: true })
              .eq("contact_id", secondary.id);

            results.deals_remapeados += dCount || 0;
            results.attendees_remapeados += aCount || 0;
            results.contatos_arquivados += 1;
          } else {
            // Remap deals
            const { data: remappedDeals } = await supabase
              .from("crm_deals")
              .update({ contact_id: principalId })
              .eq("contact_id", secondary.id)
              .select("id");

            results.deals_remapeados += (remappedDeals || []).length;

            // Remap attendees
            const { data: remappedAttendees } = await supabase
              .from("meeting_slot_attendees")
              .update({ contact_id: principalId })
              .eq("contact_id", secondary.id)
              .select("id");

            results.attendees_remapeados += (remappedAttendees || []).length;

            // Archive secondary contact
            const { error: archiveErr } = await supabase
              .from("crm_contacts")
              .update({
                merged_into_contact_id: principalId,
                merged_at: new Date().toISOString(),
                is_archived: true,
              })
              .eq("id", secondary.id);

            if (archiveErr) throw archiveErr;

            results.contatos_arquivados += 1;
          }
        }

        results.grupos_processados += 1;
      } catch (err: any) {
        results.erros.push({
          grupo: phoneSuffix,
          erro: err.message || String(err),
        });
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
