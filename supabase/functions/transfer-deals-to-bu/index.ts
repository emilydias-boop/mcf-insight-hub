import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Config: BU → default target origin + stage "Novo Lead (Form)"
const BU_TARGETS: Record<string, { origin_id: string; stage_id: string; label: string }> = {
  consorcio: {
    origin_id: "7d7b1cb5-2a44-4552-9eff-c3b798646b78", // Efeito Alavanca + Clube
    stage_id: "b5af7d28-7a0f-4da5-a115-094489fbc07d", // NOVO LEAD ( FORM )
    label: "BU - Consórcio",
  },
  incorporador: {
    origin_id: "e3c04f21-ba2c-4c66-84f8-b4341c826b1c", // PIPELINE INSIDE SALES
    stage_id: "cf4a369c-c4a6-4299-933d-5ae3dcc39d4b", // Novo Lead
    label: "BU - Incorporador MCF",
  },
};

const CONSORCIO_TARGET_SDR_PROFILE_IDS = new Set([
  "16828627-136e-42ef-9623-62dedfbc9d89", // Cleiton Anacleto Lima
  "411e4b5d-8183-4d6a-b841-88c71d50955f", // Ithaline Clara dos Santos
]);

interface Body {
  deal_ids: string[];
  target_bu: string;
  target_sdr_profile_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  bulk?: boolean;
}

async function pickLeastLoadedSdr(
  supabase: any,
  targetOriginId: string,
  targetBU: string
): Promise<{ profile_id: string; email: string; full_name: string | null } | null> {
  // SDRs cujo squad contém a BU destino e access_status = ativo
  const { data: rawCandidates } = await supabase
    .from("profiles")
    .select("id, email, full_name, squad, access_status, user_roles!inner(role)")
    .eq("access_status", "ativo")
    .contains("squad", [targetBU])
    .eq("user_roles.role", "sdr");

  const candidates =
    targetBU === "consorcio"
      ? (rawCandidates || []).filter((candidate: any) =>
          CONSORCIO_TARGET_SDR_PROFILE_IDS.has(candidate.id)
        )
      : rawCandidates || [];

  if (!candidates || candidates.length === 0) return null;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const counts = await Promise.all(
    candidates.map(async (c: any) => {
      const { count } = await supabase
        .from("crm_deals")
        .select("id", { count: "exact", head: true })
        .eq("origin_id", targetOriginId)
        .eq("owner_profile_id", c.id)
        .gte("created_at", since);
      return { c, count: count ?? 0 };
    })
  );
  counts.sort(
    (a, b) => a.count - b.count || (a.c.email || "").localeCompare(b.c.email || "")
  );
  const chosen = counts[0].c;
  return { profile_id: chosen.id, email: chosen.email, full_name: chosen.full_name };
}

async function findExistingDealInOrigin(
  supabase: any,
  contact_id: string | null,
  contactEmail: string | null,
  contactPhone: string | null,
  targetOriginId: string
): Promise<any | null> {
  const email = (contactEmail || "").toLowerCase().trim();
  const phone9 = (contactPhone || "").replace(/\D/g, "").slice(-9);
  if (!email && !phone9 && !contact_id) return null;

  const contactIds = new Set<string>();
  if (contact_id) contactIds.add(contact_id);

  if (email || phone9) {
    const orParts = [];
    if (email) orParts.push(`email.ilike.${email}`);
    if (phone9) orParts.push(`phone.ilike.%${phone9}`);
    const { data: contacts } = await supabase
      .from("crm_contacts")
      .select("id, email, phone")
      .or(orParts.join(","))
      .limit(50);
    for (const c of contacts || []) {
      const e = (c.email || "").toLowerCase().trim();
      const p9 = (c.phone || "").replace(/\D/g, "").slice(-9);
      if ((email && e === email) || (phone9 && p9 === phone9)) contactIds.add(c.id);
    }
  }

  if (contactIds.size === 0) return null;

  const { data: deals } = await supabase
    .from("crm_deals")
    .select("id, tags, stage_id, owner_id, owner_profile_id, name")
    .in("contact_id", Array.from(contactIds))
    .eq("origin_id", targetOriginId)
    .is("archived_at", null)
    .limit(1);

  return (deals || [])[0] || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = (await req.json()) as Body;
    const { deal_ids, target_bu, target_sdr_profile_id, actor_id, actor_name, bulk } = body;

    if (!Array.isArray(deal_ids) || deal_ids.length === 0) {
      return new Response(JSON.stringify({ error: "deal_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const target = BU_TARGETS[target_bu];
    if (!target) {
      return new Response(JSON.stringify({ error: `Unsupported target_bu: ${target_bu}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional pre-picked SDR
    let chosenSdr:
      | { profile_id: string; email: string; full_name: string | null }
      | null = null;
    if (target_sdr_profile_id) {
      if (target_bu === "consorcio" && !CONSORCIO_TARGET_SDR_PROFILE_IDS.has(target_sdr_profile_id)) {
        return new Response(
          JSON.stringify({
            error: "SDR destino inválido para Consórcio. Use Cleiton ou Ithaline.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: p } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", target_sdr_profile_id)
        .maybeSingle();
      if (p) chosenSdr = { profile_id: p.id, email: p.email, full_name: p.full_name };
    }

    const results: any[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const deal_id of deal_ids) {
      try {
        const { data: deal, error: dealErr } = await supabase
          .from("crm_deals")
          .select("*")
          .eq("id", deal_id)
          .maybeSingle();
        if (dealErr || !deal) {
          failed++;
          results.push({ deal_id, success: false, error: "deal not found" });
          continue;
        }

        // Skip if source deal is already on target origin
        if (deal.origin_id === target.origin_id) {
          skipped++;
          results.push({
            deal_id,
            success: true,
            skipped: true,
            reason: "already_on_target_bu",
          });
          continue;
        }

        let contactEmail: string | null = null;
        let contactPhone: string | null = null;
        if (deal.contact_id) {
          const { data: c } = await supabase
            .from("crm_contacts")
            .select("email, phone")
            .eq("id", deal.contact_id)
            .maybeSingle();
          contactEmail = c?.email ?? null;
          contactPhone = c?.phone ?? null;
        }

        // Pick SDR (per-deal least-load) unless a fixed one was chosen
        const sdr =
          chosenSdr ??
          (await pickLeastLoadedSdr(supabase, target.origin_id, target_bu));

        const existing = await findExistingDealInOrigin(
          supabase,
          deal.contact_id,
          contactEmail,
          contactPhone,
          target.origin_id
        );

        const sourceTags: string[] = Array.isArray(deal.tags) ? deal.tags : [];

        if (existing) {
          // Merge tags without duplicates
          const existingTags: string[] = Array.isArray(existing.tags) ? existing.tags : [];
          const mergedTags = Array.from(new Set([...existingTags, ...sourceTags]));
          const update: Record<string, any> = {
            tags: mergedTags,
            stage_id: target.stage_id, // move to Novo Lead (Form)
          };
          if (sdr) {
            update.owner_id = sdr.email;
            update.owner_profile_id = sdr.profile_id;
          }
          const { error: updErr } = await supabase
            .from("crm_deals")
            .update(update)
            .eq("id", existing.id);
          if (updErr) throw updErr;

          await supabase.from("deal_activities").insert({
            deal_id: existing.id,
            activity_type: "bu_transfer",
            description: `Transferido de outra BU (deal origem ${deal.id})${
              sdr ? ` — Atribuído a ${sdr.full_name || sdr.email}` : ""
            }`,
            user_id: actor_id ?? null,
            metadata: {
              from_deal_id: deal.id,
              from_origin_id: deal.origin_id,
              to_bu: target_bu,
              to_origin_id: target.origin_id,
              matched_existing: true,
              target_sdr: sdr,
              bulk: !!bulk,
              actor_name: actor_name ?? null,
            },
          });

          await supabase.from("deal_activities").insert({
            deal_id: deal.id,
            activity_type: "bu_transfer",
            description: `Lead reforçado em ${target.label} (deal existente ${existing.id})${
              sdr ? ` — Atribuído a ${sdr.full_name || sdr.email}` : ""
            }`,
            user_id: actor_id ?? null,
            metadata: {
              target_deal_id: existing.id,
              to_bu: target_bu,
              to_origin_id: target.origin_id,
              matched_existing: true,
              target_sdr: sdr,
              bulk: !!bulk,
              actor_name: actor_name ?? null,
            },
          });

          updated++;
          results.push({
            deal_id,
            success: true,
            updated: true,
            target_deal_id: existing.id,
            assigned_sdr: sdr?.email ?? null,
          });
        } else {
          // Create new deal on target BU
          const newDeal: Record<string, any> = {
            name: deal.name,
            value: deal.value,
            contact_id: deal.contact_id,
            origin_id: target.origin_id,
            stage_id: target.stage_id,
            owner_id: sdr?.email ?? null,
            owner_profile_id: sdr?.profile_id ?? null,
            tags: sourceTags,
            replicated_from_deal_id: deal.id,
            replicated_at: new Date().toISOString(),
            data_source: "replication",
            clint_id: `bu-transfer-${deal.id}-${target.origin_id}`,
          };

          const { data: createdDeal, error: createErr } = await supabase
            .from("crm_deals")
            .insert(newDeal)
            .select()
            .single();
          if (createErr) throw createErr;

          await supabase.from("deal_activities").insert({
            deal_id: createdDeal.id,
            activity_type: "bu_transfer",
            description: `Deal criado via transferência de BU (origem ${deal.id})${
              sdr ? ` — Atribuído a ${sdr.full_name || sdr.email}` : ""
            }`,
            user_id: actor_id ?? null,
            metadata: {
              from_deal_id: deal.id,
              from_origin_id: deal.origin_id,
              to_bu: target_bu,
              matched_existing: false,
              target_sdr: sdr,
              bulk: !!bulk,
              actor_name: actor_name ?? null,
            },
          });

          await supabase.from("deal_activities").insert({
            deal_id: deal.id,
            activity_type: "bu_transfer",
            description: `Lead replicado em ${target.label} (novo deal ${createdDeal.id})${
              sdr ? ` — Atribuído a ${sdr.full_name || sdr.email}` : ""
            }`,
            user_id: actor_id ?? null,
            metadata: {
              target_deal_id: createdDeal.id,
              to_bu: target_bu,
              to_origin_id: target.origin_id,
              matched_existing: false,
              target_sdr: sdr,
              bulk: !!bulk,
              actor_name: actor_name ?? null,
            },
          });

          created++;
          results.push({
            deal_id,
            success: true,
            created: true,
            target_deal_id: createdDeal.id,
            assigned_sdr: sdr?.email ?? null,
          });
        }
      } catch (err) {
        failed++;
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null
              ? JSON.stringify(err)
              : String(err);
        console.error(`transfer-deals-to-bu error on ${deal_id}:`, msg);
        results.push({ deal_id, success: false, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: deal_ids.length,
        created,
        updated,
        skipped,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("transfer-deals-to-bu fatal:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
