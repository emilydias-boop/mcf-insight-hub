// Cron leve: a cada 30min, atualiza approval_status dos templates com status 'pending'.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function authHeader(): string {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) throw new Error("TWILIO creds ausentes");
  return "Basic " + btoa(`${sid}:${token}`);
}

function mapStatus(s?: string) {
  if (!s) return "unknown";
  const x = s.toLowerCase();
  if (x === "approved") return "approved";
  if (x === "rejected") return "rejected";
  if (x === "paused") return "paused";
  if (x === "disabled") return "disabled";
  if (x === "received" || x === "pending" || x === "submitted") return "pending";
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const auth = authHeader();

    const { data: pendentes, error } = await sb
      .from("automation_templates")
      .select("id, twilio_template_sid")
      .eq("approval_status", "pending")
      .not("twilio_template_sid", "is", null)
      .limit(50);
    if (error) throw error;

    const checked: Array<{ id: string; status: string }> = [];
    for (const t of pendentes ?? []) {
      try {
        const r = await fetch(
          `https://content.twilio.com/v1/Content/${t.twilio_template_sid}/ApprovalRequests`,
          { headers: { Authorization: auth } },
        );
        if (!r.ok) continue;
        const data = await r.json();
        const newStatus = mapStatus(data?.whatsapp?.status);
        const reason = data?.whatsapp?.rejection_reason ?? null;
        await sb
          .from("automation_templates")
          .update({
            approval_status: newStatus,
            approval_updated_at: new Date().toISOString(),
            approval_rejected_reason: reason,
          })
          .eq("id", t.id);
        checked.push({ id: t.id, status: newStatus });
      } catch (innerErr) {
        console.error("[poll] item erro", t.id, innerErr);
      }
    }

    return new Response(JSON.stringify({ success: true, checked }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[twilio-content-status-poll] erro:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});