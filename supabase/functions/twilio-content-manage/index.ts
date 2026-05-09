// Twilio Content Manager — cria, lista, submete e checa status de templates HSM via Twilio Content API.
// Usa direto api.twilio.com (Basic Auth com TWILIO_ACCOUNT_SID/AUTH_TOKEN), espelhando twilio-whatsapp-send.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ButtonConfig = {
  type: "url" | "quick_reply";
  text: string;
  url?: string;
  url_param_key?: string; // se a URL tem {{1}}, indica o nome semântico (apenas metadata)
  id?: string;
};

type Action =
  | { action: "list" }
  | { action: "status"; templateId: string }
  | { action: "create"; templateId: string }
  | { action: "submit"; templateId: string }
  | { action: "delete_remote"; templateId: string };

function twilioAuthHeader(): string {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID/AUTH_TOKEN não configurados");
  return "Basic " + btoa(`${sid}:${token}`);
}

/**
 * Mapeia status Twilio/Meta para nosso enum.
 * Twilio retorna: 'received' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled'
 */
function mapApprovalStatus(twilioStatus?: string): string {
  if (!twilioStatus) return "unknown";
  const s = twilioStatus.toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "paused") return "paused";
  if (s === "disabled") return "disabled";
  if (s === "received" || s === "pending" || s === "submitted") return "pending";
  return "unknown";
}

/**
 * Converte conteúdo + botões salvos no DB no payload aceito pela Content API.
 * Estratégia simples: usamos `twilio/text` quando não há botões, e `twilio/quick-reply`
 * ou `twilio/call-to-action` quando há.
 */
function buildContentPayload(opts: {
  friendly_name: string;
  language: string;
  content: string;
  variables: string[];
  buttons: ButtonConfig[];
}) {
  const { friendly_name, language, content, variables, buttons } = opts;

  // Twilio proíbe [_*~{}\n] em títulos de botão. Substituímos {{var}} pelo nome da
  // variável (sem chaves) e removemos demais caracteres inválidos.
  const sanitizeTitle = (raw: string): string => {
    const noVars = (raw ?? "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, "$1");
    return noVars.replace(/[_*~{}\n\r]/g, "").trim().slice(0, 25);
  };

  // Twilio espera placeholders {{1}}, {{2}} … no body. Convertemos {{nome}} → {{1}} preservando ordem
  // e construímos um mapa de variáveis "samples".
  let twilioBody = content;
  const samples: Record<string, string> = {};
  variables.forEach((name, idx) => {
    const i = String(idx + 1);
    const re = new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "g");
    twilioBody = twilioBody.replace(re, `{{${i}}}`);
    samples[i] = `Exemplo ${name}`;
  });

  // Aplica a mesma substituição {{var}} → {{N}} nas URLs dos botões
  // (Twilio só interpola placeholders posicionais; nomeados ficam literais).
  const interpolateButtonUrl = (raw: string): string => {
    let out = raw;
    variables.forEach((name, idx) => {
      const i = String(idx + 1);
      const re = new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "g");
      out = out.replace(re, `{{${i}}}`);
    });
    return out;
  };

  let types: Record<string, unknown>;

  if (buttons.length === 0) {
    types = {
      "twilio/text": { body: twilioBody },
    };
  } else {
    const hasUrl = buttons.some((b) => b.type === "url");
    if (hasUrl) {
      types = {
        "twilio/call-to-action": {
          body: twilioBody,
          actions: buttons.map((b) => {
            const title = sanitizeTitle(b.text);
            return b.type === "url"
              ? { type: "URL", title, url: interpolateButtonUrl(b.url ?? "https://example.com") }
              : { type: "QUICK_REPLY", title, id: b.id ?? title };
          }),
        },
      };
    } else {
      types = {
        "twilio/quick-reply": {
          body: twilioBody,
          actions: buttons.map((b) => {
            const title = sanitizeTitle(b.text);
            return { title, id: b.id ?? title };
          }),
        },
      };
    }
  }

  return {
    friendly_name,
    language,
    variables: samples,
    types,
  };
}

async function createTwilioContent(baseUrl: string, auth: string, payload: ReturnType<typeof buildContentPayload>) {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return { response, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = (await req.json().catch(() => ({}))) as Action;
    const action = (body as { action?: string }).action;
    if (!action) throw new Error("Missing 'action'");

    const auth = twilioAuthHeader();
    const baseUrl = "https://content.twilio.com/v1/Content";

    if (action === "list") {
      const r = await fetch(`${baseUrl}?PageSize=50`, { headers: { Authorization: auth } });
      const data = await r.json();
      return new Response(JSON.stringify({ success: r.ok, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: r.ok ? 200 : 400,
      });
    }

    const { templateId } = body as { templateId: string };
    if (!templateId) throw new Error("Missing 'templateId'");

    const { data: tpl, error: tplErr } = await sb
      .from("automation_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    if (tplErr) throw tplErr;
    if (!tpl) throw new Error("Template não encontrado");

    if (action === "create") {
      if (tpl.twilio_template_sid) {
        return new Response(
          JSON.stringify({ success: false, error: "Template já tem ContentSid", sid: tpl.twilio_template_sid }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
        );
      }
      const payload = buildContentPayload({
        friendly_name: tpl.name,
        language: tpl.language ?? "pt_BR",
        content: tpl.content,
        variables: (tpl.variables as string[] | null) ?? [],
        buttons: ((tpl.buttons_config as ButtonConfig[] | null) ?? []),
      });
      const { response: r, data } = await createTwilioContent(baseUrl, auth, payload);
      if (!r.ok) {
        return new Response(JSON.stringify({ success: false, error: data?.message ?? "Twilio error", data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
      const sid = data.sid as string;
      await sb
        .from("automation_templates")
        .update({
          twilio_template_sid: sid,
          approval_status: "draft",
          variable_count: ((tpl.variables as string[] | null) ?? []).length,
        })
        .eq("id", templateId);
      return new Response(JSON.stringify({ success: true, sid, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "submit") {
      let sid = tpl.twilio_template_sid as string | null;
      const approvalStatus = String(tpl.approval_status ?? "draft").toLowerCase();

      // Enquanto o template está em rascunho/rejeitado, o ContentSid remoto pode estar
      // defasado em relação ao DB. Recriamos antes de submeter para garantir que a
      // versão enviada à Meta receba os títulos de botão sanitizados.
      if (!sid || ["draft", "rejected", "unknown"].includes(approvalStatus)) {
        const oldSid = sid;
        const payload = buildContentPayload({
          friendly_name: tpl.name,
          language: tpl.language ?? "pt_BR",
          content: tpl.content,
          variables: (tpl.variables as string[] | null) ?? [],
          buttons: ((tpl.buttons_config as ButtonConfig[] | null) ?? []),
        });
        const { response: createResponse, data: createData } = await createTwilioContent(baseUrl, auth, payload);
        if (!createResponse.ok || !createData?.sid) {
          return new Response(JSON.stringify({ success: false, error: createData?.message ?? "Twilio error", data: createData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }
        sid = createData.sid as string;
        await sb
          .from("automation_templates")
          .update({
            twilio_template_sid: sid,
            approval_status: "draft",
            variable_count: ((tpl.variables as string[] | null) ?? []).length,
            approval_updated_at: new Date().toISOString(),
          })
          .eq("id", templateId);
        if (oldSid && oldSid !== sid) {
          await fetch(`${baseUrl}/${oldSid}`, { method: "DELETE", headers: { Authorization: auth } }).catch(() => null);
        }
      }
      const payload = {
        name: tpl.name.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 64),
        category: (tpl.category ?? "utility").toUpperCase(),
        allow_category_change: true,
      };
      const submitApproval = async (contentSid: string) =>
        fetch(`${baseUrl}/${contentSid}/ApprovalRequests/whatsapp`, {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      let r = await submitApproval(sid as string);
      let data = await r.json();
      // Se o ContentSid no DB estiver órfão no Twilio (404), recriamos e tentamos de novo.
      if (r.status === 404) {
        const oldSid = sid;
        const recreatePayload = buildContentPayload({
          friendly_name: tpl.name,
          language: tpl.language ?? "pt_BR",
          content: tpl.content,
          variables: (tpl.variables as string[] | null) ?? [],
          buttons: ((tpl.buttons_config as ButtonConfig[] | null) ?? []),
        });
        const { response: createResponse, data: createData } = await createTwilioContent(baseUrl, auth, recreatePayload);
        if (createResponse.ok && createData?.sid) {
          sid = createData.sid as string;
          await sb
            .from("automation_templates")
            .update({ twilio_template_sid: sid, approval_updated_at: new Date().toISOString() })
            .eq("id", templateId);
          if (oldSid && oldSid !== sid) {
            await fetch(`${baseUrl}/${oldSid}`, { method: "DELETE", headers: { Authorization: auth } }).catch(() => null);
          }
          r = await submitApproval(sid);
          data = await r.json();
        }
      }
      if (!r.ok) {
        return new Response(JSON.stringify({ success: false, error: data?.message ?? "Twilio error", data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
      await sb
        .from("automation_templates")
        .update({
          approval_status: "pending",
          approval_submitted_at: new Date().toISOString(),
          approval_updated_at: new Date().toISOString(),
          approval_rejected_reason: null,
        })
        .eq("id", templateId);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const sid = tpl.twilio_template_sid;
      if (!sid) {
        return new Response(JSON.stringify({ success: true, status: "draft" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r = await fetch(`${baseUrl}/${sid}/ApprovalRequests`, { headers: { Authorization: auth } });
      const data = await r.json();
      const wa = data?.whatsapp;
      const newStatus = mapApprovalStatus(wa?.status);
      const reason = wa?.rejection_reason ?? null;
      await sb
        .from("automation_templates")
        .update({
          approval_status: newStatus,
          approval_updated_at: new Date().toISOString(),
          approval_rejected_reason: reason,
        })
        .eq("id", templateId);
      return new Response(JSON.stringify({ success: true, status: newStatus, raw: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_remote") {
      const sid = tpl.twilio_template_sid;
      if (!sid) throw new Error("Sem ContentSid pra deletar");
      const r = await fetch(`${baseUrl}/${sid}`, { method: "DELETE", headers: { Authorization: auth } });
      if (!r.ok && r.status !== 404) {
        const data = await r.json().catch(() => ({}));
        return new Response(JSON.stringify({ success: false, error: data?.message ?? "Twilio error", data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
      await sb
        .from("automation_templates")
        .update({ twilio_template_sid: null, approval_status: "draft", approval_submitted_at: null })
        .eq("id", templateId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[twilio-content-manage] erro:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});