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

    // Use RPC to get duplicate phone groups efficiently
    const { data: groups, error: groupsError } = await supabase.rpc(
      "get_duplicate_contact_phones",
      { limit_count: batch_size * 3 }
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

    for (const group of (groups || [])) {
      if (results.grupos_processados >= batch_size) break;

      const phoneSuffix = group.phone_suffix as string;

      try {
        // Use ilike to find contacts matching this suffix
        const { data: contacts, error: contactsErr } = await supabase
          .from("crm_contacts")
          .select("id, name, created_at, is_archived")
          .ilike("phone", `%${phoneSuffix}`)
          .eq("is_archived", false)
          .order("created_at", { ascending: true })
          .limit(20);

        if (contactsErr) throw contactsErr;
        if (!contacts || contacts.length < 2) continue;

        const contactIds = contacts.map((c: any) => c.id);

        // Check if group has deals
        const { count: dealCount } = await supabase
          .from("crm_deals")
          .select("id", { count: "exact", head: true })
          .in("contact_id", contactIds);

        if (!dealCount || dealCount === 0) continue;

        const principalId = contacts[0].id;
        const secondaries = contacts.slice(1);

        for (const sec of secondaries) {
          if (dry_run) {
            const { count: dC } = await supabase
              .from("crm_deals")
              .select("id", { count: "exact", head: true })
              .eq("contact_id", sec.id);

            const { count: aC } = await supabase
              .from("meeting_slot_attendees")
              .select("id", { count: "exact", head: true })
              .eq("contact_id", sec.id);

            results.deals_remapeados += dC || 0;
            results.attendees_remapeados += aC || 0;
            results.contatos_arquivados += 1;
          } else {
            const { data: rd } = await supabase
              .from("crm_deals")
              .update({ contact_id: principalId })
              .eq("contact_id", sec.id)
              .select("id");
            results.deals_remapeados += (rd || []).length;

            const { data: ra } = await supabase
              .from("meeting_slot_attendees")
              .update({ contact_id: principalId })
              .eq("contact_id", sec.id)
              .select("id");
            results.attendees_remapeados += (ra || []).length;

            const { error: archErr } = await supabase
              .from("crm_contacts")
              .update({
                merged_into_contact_id: principalId,
                merged_at: new Date().toISOString(),
                is_archived: true,
              })
              .eq("id", sec.id);

            if (archErr) throw archErr;
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
