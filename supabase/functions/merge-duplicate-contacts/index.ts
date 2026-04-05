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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Use a single optimized SQL query to get all groups with contact details
    // via PostgREST SQL function
    const pgResp = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_duplicate_contact_phones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ limit_count: batch_size }),
      }
    );

    if (!pgResp.ok) throw new Error(`RPC error: ${await pgResp.text()}`);
    const groups = await pgResp.json();

    const results = {
      dry_run,
      grupos_processados: 0,
      deals_remapeados: 0,
      attendees_remapeados: 0,
      contatos_arquivados: 0,
      erros: [] as { grupo: string; erro: string }[],
    };

    for (const group of groups) {
      if (results.grupos_processados >= batch_size) break;
      const phoneSuffix = group.phone_suffix as string;

      try {
        // Get all contacts with this phone suffix using SQL-based filtering
        // We query all contacts with phone ending in these digits
        const { data: allContacts, error: cErr } = await supabase
          .from("crm_contacts")
          .select("id, phone, created_at")
          .eq("is_archived", false)
          .not("phone", "is", null)
          .order("created_at", { ascending: true });

        if (cErr) throw cErr;

        // Filter by suffix match (since phone formats vary)
        const matching = (allContacts || []).filter((c: any) => {
          const digits = (c.phone || "").replace(/\D/g, "");
          return digits.length >= 9 && digits.slice(-9) === phoneSuffix;
        });

        if (matching.length < 2) continue;

        const principalId = matching[0].id;
        const secondaryIds = matching.slice(1).map((c: any) => c.id);

        // Check deals exist
        const { count: dealCheck } = await supabase
          .from("crm_deals")
          .select("id", { count: "exact", head: true })
          .in("contact_id", matching.map((c: any) => c.id));

        if (!dealCheck) continue;

        if (dry_run) {
          const { count: dC } = await supabase
            .from("crm_deals")
            .select("id", { count: "exact", head: true })
            .in("contact_id", secondaryIds);

          const { count: aC } = await supabase
            .from("meeting_slot_attendees")
            .select("id", { count: "exact", head: true })
            .in("contact_id", secondaryIds);

          results.deals_remapeados += dC || 0;
          results.attendees_remapeados += aC || 0;
          results.contatos_arquivados += secondaryIds.length;
        } else {
          const { data: rd } = await supabase
            .from("crm_deals")
            .update({ contact_id: principalId })
            .in("contact_id", secondaryIds)
            .select("id");
          results.deals_remapeados += (rd || []).length;

          const { data: ra } = await supabase
            .from("meeting_slot_attendees")
            .update({ contact_id: principalId })
            .in("contact_id", secondaryIds)
            .select("id");
          results.attendees_remapeados += (ra || []).length;

          for (const secId of secondaryIds) {
            await supabase
              .from("crm_contacts")
              .update({
                merged_into_contact_id: principalId,
                merged_at: new Date().toISOString(),
                is_archived: true,
              })
              .eq("id", secId);
          }
          results.contatos_arquivados += secondaryIds.length;
        }

        results.grupos_processados += 1;
      } catch (err: any) {
        results.erros.push({ grupo: phoneSuffix, erro: err.message || String(err) });
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
