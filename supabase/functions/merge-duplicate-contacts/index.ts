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

    // Single optimized query returns groups with contact_ids already ordered
    const { data: groups, error: gErr } = await supabase.rpc("get_merge_groups", {
      p_batch_size: batch_size,
    });
    if (gErr) throw gErr;

    const results = {
      dry_run,
      grupos_processados: 0,
      deals_remapeados: 0,
      attendees_remapeados: 0,
      contatos_arquivados: 0,
      erros: [] as { grupo: string; erro: string }[],
    };

    for (const group of groups || []) {
      const phoneSuffix = group.phone_suffix as string;
      const contactIds = group.contact_ids as string[];

      if (contactIds.length < 2) continue;

      const principalId = contactIds[0];
      const secondaryIds = contactIds.slice(1);

      try {
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
          // Remap deals
          const { data: rd } = await supabase
            .from("crm_deals")
            .update({ contact_id: principalId })
            .in("contact_id", secondaryIds)
            .select("id");
          results.deals_remapeados += (rd || []).length;

          // Remap attendees
          const { data: ra } = await supabase
            .from("meeting_slot_attendees")
            .update({ contact_id: principalId })
            .in("contact_id", secondaryIds)
            .select("id");
          results.attendees_remapeados += (ra || []).length;

          // Archive secondaries
          for (const secId of secondaryIds) {
            const { error: archErr } = await supabase
              .from("crm_contacts")
              .update({
                merged_into_contact_id: principalId,
                merged_at: new Date().toISOString(),
                is_archived: true,
              })
              .eq("id", secId);
            if (archErr) throw archErr;
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
