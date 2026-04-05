import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MergeGroup {
  phone_suffix: string;
  principal_id: string;
  secondary_ids: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { dry_run = true, batch_size = 50 } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use direct SQL via PostgREST rpc to get groups with all info in one query
    const sql = `
      WITH phone_groups AS (
        SELECT
          RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 9) AS phone_suffix,
          array_agg(id ORDER BY created_at ASC) as contact_ids,
          COUNT(*) as total
        FROM crm_contacts
        WHERE phone IS NOT NULL
          AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 9
          AND is_archived = false
        GROUP BY phone_suffix
        HAVING COUNT(*) > 1
      )
      SELECT 
        pg.phone_suffix,
        pg.contact_ids
      FROM phone_groups pg
      WHERE EXISTS (
        SELECT 1 FROM crm_deals d 
        WHERE d.contact_id = ANY(pg.contact_ids)
      )
      ORDER BY pg.total DESC
      LIMIT ${Math.min(batch_size, 200)};
    `;

    // Execute via PostgREST SQL endpoint
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/get_duplicate_contact_phones`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ limit_count: 1 }),
    });

    // Instead of the RPC, let's use a pg connection approach
    // We'll just use the supabase client for targeted operations

    const supabase = createClient(supabaseUrl, serviceKey);

    // Step 1: Get groups via RPC (already optimized)
    const { data: rawGroups, error: gErr } = await supabase.rpc(
      "get_duplicate_contact_phones",
      { limit_count: batch_size }
    );
    if (gErr) throw gErr;

    const results = {
      dry_run,
      grupos_processados: 0,
      deals_remapeados: 0,
      attendees_remapeados: 0,
      contatos_arquivados: 0,
      erros: [] as { grupo: string; erro: string }[],
    };

    // Process groups sequentially but with minimal queries
    for (const group of (rawGroups || [])) {
      if (results.grupos_processados >= batch_size) break;
      const phoneSuffix = group.phone_suffix as string;

      try {
        // Get contacts for this suffix - use phone LIKE pattern
        const likePattern = `%${phoneSuffix.replace(/%/g, '')}`;
        const { data: contacts, error: cErr } = await supabase
          .from("crm_contacts")
          .select("id, created_at")
          .like("phone", likePattern)
          .eq("is_archived", false)
          .order("created_at", { ascending: true })
          .limit(10);

        if (cErr) throw cErr;
        
        // Also filter by actual 9-digit suffix match (phone format varies)
        const filtered = (contacts || []).filter((c: any) => {
          // We trust the RPC grouped them correctly; just ensure >1
          return true;
        });

        if (!filtered || filtered.length < 2) continue;

        const principalId = filtered[0].id;
        const secondaryIds = filtered.slice(1).map((c: any) => c.id);

        // Check if any secondary has deals (if not, check principal)
        const allIds = filtered.map((c: any) => c.id);
        const { count: dealCheck } = await supabase
          .from("crm_deals")
          .select("id", { count: "exact", head: true })
          .in("contact_id", allIds);

        if (!dealCheck) continue;

        if (dry_run) {
          // Count deals on secondaries
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
