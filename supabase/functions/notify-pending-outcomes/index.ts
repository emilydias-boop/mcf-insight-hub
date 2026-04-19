// notify-pending-outcomes
// Cron diário: encontra R1 Realizadas (BU Consórcio) >24h sem desfecho
// e cria notificações para o closer (>72h também notifica gestores).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VDA_R1_REALIZADA = "0f450ec9-0f00-4fbe-8400-cdb2440897e5";
const EA_R1_REALIZADA = "f7c48a43-4ca3-45a1-85d0-e6da76c3cff2";
const R1_REALIZADA_IDS = [VDA_R1_REALIZADA, EA_R1_REALIZADA];

const VDA_ORIGIN = "4e2b810a-6782-4ce9-9c0d-10d04c018636";
const EA_ORIGIN = "7d7b1cb5-2a44-4552-9eff-c3b798646b78";
const CONSORCIO_ORIGINS = [VDA_ORIGIN, EA_ORIGIN];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const now = Date.now();
    const since24h = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(); // janela 7d

    // Deals em R1 Realizada nos últimos 7 dias
    const { data: deals, error } = await supabase
      .from("crm_deals")
      .select("id, name, owner_id, origin_id, updated_at, crm_contacts(name)")
      .in("stage_id", R1_REALIZADA_IDS)
      .in("origin_id", CONSORCIO_ORIGINS)
      .gte("updated_at", since24h);
    if (error) throw error;
    if (!deals || deals.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dealIds = deals.map((d) => d.id);

    // Deals com proposta (qualquer status)
    const { data: proposals } = await supabase
      .from("consorcio_proposals")
      .select("deal_id")
      .in("deal_id", dealIds);
    const withProposal = new Set(
      (proposals || []).map((p) => p.deal_id).filter(Boolean)
    );

    // Group by closer email (owner_id)
    const pendingByCloser: Record<
      string,
      { count: number; over72h: number; sample: string[] }
    > = {};

    for (const d of deals) {
      if (withProposal.has(d.id)) continue;
      const ownerEmail = (d.owner_id || "").toLowerCase();
      if (!ownerEmail) continue;
      const ageH = (now - new Date(d.updated_at).getTime()) / (1000 * 60 * 60);
      if (ageH < 24) continue;

      if (!pendingByCloser[ownerEmail]) {
        pendingByCloser[ownerEmail] = { count: 0, over72h: 0, sample: [] };
      }
      pendingByCloser[ownerEmail].count++;
      if (ageH >= 72) pendingByCloser[ownerEmail].over72h++;
      const contactName = (d.crm_contacts as any)?.name || d.name || "Lead";
      if (pendingByCloser[ownerEmail].sample.length < 3) {
        pendingByCloser[ownerEmail].sample.push(contactName);
      }
    }

    const emails = Object.keys(pendingByCloser);
    if (emails.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve emails -> profiles.id
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("email", emails);
    const idByEmail: Record<string, string> = {};
    (profiles || []).forEach((p) => {
      if (p.email) idByEmail[p.email.toLowerCase()] = p.id;
    });

    // Managers (notificar quando closer >72h)
    const { data: managers } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["manager", "admin"]);
    const managerIds = (managers || []).map((m) => m.user_id);

    let created = 0;
    for (const [email, info] of Object.entries(pendingByCloser)) {
      const userId = idByEmail[email];
      if (!userId) continue;

      // Closer notification
      await supabase.from("alertas").insert({
        user_id: userId,
        tipo: "consorcio_pending_outcome",
        titulo: `${info.count} reuniões sem desfecho`,
        descricao: `Você possui ${info.count} R1 Realizada(s) sem registrar Proposta/Sem Sucesso/Aguardar. Exemplos: ${info.sample.join(", ")}.`,
        metadata: { count: info.count, over72h: info.over72h },
      });
      created++;

      // Manager notification when over 72h
      if (info.over72h > 0 && managerIds.length > 0) {
        for (const mId of managerIds) {
          await supabase.from("alertas").insert({
            user_id: mId,
            tipo: "consorcio_pending_outcome_manager",
            titulo: `Closer com desfechos atrasados (>72h)`,
            descricao: `${email} possui ${info.over72h} reunião(ões) sem desfecho há mais de 72h.`,
            metadata: { closer_email: email, over72h: info.over72h },
          });
          created++;
        }
      }
    }

    return new Response(
      JSON.stringify({ processed: emails.length, alerts_created: created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-pending-outcomes error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
