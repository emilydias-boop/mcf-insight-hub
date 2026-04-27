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
    const { dry_run = true, batch_size = 50, strict = false } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Single optimized query returns groups with contact_ids already ordered
    const rpcName = strict ? "get_merge_groups_strict" : "get_merge_groups";
    const { data: groups, error: gErr } = await supabase.rpc(rpcName, {
      p_batch_size: batch_size,
    });
    if (gErr) throw gErr;

    const results = {
      dry_run,
      grupos_processados: 0,
      deals_remapeados: 0,
      attendees_remapeados: 0,
      contatos_arquivados: 0,
      deals_arquivados: 0,
      atividades_movidas: 0,
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

          // Estimate deals to be archived: simulate post-remap grouping
          const { data: simDeals } = await supabase
            .from("crm_deals")
            .select("id, origin_id")
            .in("contact_id", [principalId, ...secondaryIds])
            .eq("is_archived", false);
          const counts: Record<string, number> = {};
          for (const d of simDeals || []) {
            if (!d.origin_id) continue;
            counts[d.origin_id] = (counts[d.origin_id] || 0) + 1;
          }
          for (const o of Object.keys(counts)) {
            if (counts[o] > 1) results.deals_arquivados += counts[o] - 1;
          }
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

          // ========== CONSOLIDATE DUPLICATE DEALS ==========
          // After remap, principalId may have multiple active deals in the same origin_id.
          // Keep the most advanced one (max stage_order, then oldest), migrate history, archive the rest.
          const { data: principalDeals } = await supabase
            .from("crm_deals")
            .select("id, origin_id, stage_id, created_at, crm_stages(stage_order)")
            .eq("contact_id", principalId)
            .eq("is_archived", false);

          // Group by origin_id
          const byOrigin: Record<string, any[]> = {};
          for (const d of principalDeals || []) {
            if (!d.origin_id) continue;
            (byOrigin[d.origin_id] ||= []).push(d);
          }

          for (const originId of Object.keys(byOrigin)) {
            const deals = byOrigin[originId];
            if (deals.length < 2) continue;

            // Elect canonical: highest stage_order (nulls last), then oldest created_at
            deals.sort((a, b) => {
              const sa = a.crm_stages?.stage_order ?? -1;
              const sb = b.crm_stages?.stage_order ?? -1;
              if (sb !== sa) return sb - sa;
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });
            const principalDealId = deals[0].id;
            const secondaryDealIds = deals.slice(1).map((d) => d.id);

            // Move history tables -> principal deal
            const tablesToRemap = [
              "deal_activities",
              "deal_tasks",
              "meeting_slots",
              "calls",
              "consorcio_pending_registrations",
              "automation_queue",
              "automation_logs",
            ];
            for (const tbl of tablesToRemap) {
              const { data: moved, error: moveErr } = await supabase
                .from(tbl)
                .update({ deal_id: principalDealId })
                .in("deal_id", secondaryDealIds)
                .select("id");
              if (moveErr) {
                // Table might not have deal_id; ignore silently
                continue;
              }
              if (tbl === "deal_activities") {
                results.atividades_movidas += (moved || []).length;
              }
            }

            // Audit trail activity on the principal
            await supabase.from("deal_activities").insert({
              deal_id: principalDealId,
              activity_type: "merge",
              description: `Mesclado a partir do(s) deal(s) ${secondaryDealIds.join(", ")} em ${new Date().toISOString()}`,
            } as any);

            // Archive secondary deals
            const nowIso = new Date().toISOString();
            for (const secDealId of secondaryDealIds) {
              const { error: archDealErr } = await supabase
                .from("crm_deals")
                .update({
                  merged_into_deal_id: principalDealId,
                  merged_at: nowIso,
                  is_archived: true,
                })
                .eq("id", secDealId);
              if (archDealErr) throw archDealErr;
            }
            results.deals_arquivados += secondaryDealIds.length;
          }
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
