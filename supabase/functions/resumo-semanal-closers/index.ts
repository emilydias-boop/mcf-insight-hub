// Resumo semanal (segunda a domingo anterior) de reuniões R1 e conversão por closer,
// enviado por e-mail aos coordenadores/gerentes ativos de cada BU. Idempotente por semana+BU.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BU_NOME: Record<string, string> = {
  incorporador: "Incorporador", consorcio: "Consórcio", credito: "Crédito", solar: "Solar",
};

function semanaAnterior(): { inicio: string; fim: string } {
  const sp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dow = (sp.getDay() + 6) % 7; // 0 = segunda
  const segAtual = new Date(sp); segAtual.setDate(sp.getDate() - dow);
  const ini = new Date(segAtual); ini.setDate(segAtual.getDate() - 7);
  const fim = new Date(segAtual); fim.setDate(segAtual.getDate() - 1);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: f(ini), fim: f(fim) };
}
const br = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

type Linha = { closer_nome: string; bu: string | null; reunioes_realizadas: number; participantes_atendidos: number; contratos_pagos: number; conversao_pct: number | null };

function html(bu: string, inicio: string, fim: string, linhas: Linha[]) {
  const tot = linhas.reduce((a, l) => ({
    r: a.r + l.reunioes_realizadas, p: a.p + l.participantes_atendidos, c: a.c + l.contratos_pagos,
  }), { r: 0, p: 0, c: 0 });
  const conv = (c: number, p: number) => (p > 0 ? `${((100 * c) / p).toFixed(1).replace(".", ",")}%` : "-");
  const td = 'style="padding:6px 10px;border-bottom:1px solid #ddd"';
  const rows = linhas.map((l) =>
    `<tr><td ${td}>${esc(l.closer_nome)}</td><td ${td} align="right">${l.reunioes_realizadas}</td><td ${td} align="right">${l.participantes_atendidos}</td><td ${td} align="right">${l.contratos_pagos}</td><td ${td} align="right">${conv(l.contratos_pagos, l.participantes_atendidos)}</td></tr>`
  ).join("");
  return `<div style="font-family:Arial,sans-serif;color:#222">
<h2>Resumo semanal dos closers — ${esc(BU_NOME[bu] ?? bu)}</h2>
<p>Semana de ${br(inicio)} a ${br(fim)} (reuniões R1 realizadas).</p>
<table style="border-collapse:collapse;font-size:14px">
<tr><th ${td} align="left">Closer</th><th ${td}>Reuniões realizadas</th><th ${td}>Participantes atendidos</th><th ${td}>Contratos pagos</th><th ${td}>Conversão</th></tr>
${rows}
<tr><td ${td}><b>Total</b></td><td ${td} align="right"><b>${tot.r}</b></td><td ${td} align="right"><b>${tot.p}</b></td><td ${td} align="right"><b>${tot.c}</b></td><td ${td} align="right"><b>${conv(tot.c, tot.p)}</b></td></tr>
</table>
<p style="font-size:12px;color:#666">Conversão = contratos pagos (sem reembolso) ÷ participantes atendidos (sem no-show). Enviado automaticamente pelo MCF Gestão.</p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) return json({ error: "BREVO_API_KEY ausente" }, 500);

    const { inicio, fim } = semanaAnterior();
    const { data: dados, error } = await sb.rpc("resumo_semanal_closers", { _inicio: inicio, _fim: fim });
    if (error) throw error;

    const porBu = new Map<string, Linha[]>();
    for (const l of (dados ?? []) as Linha[]) {
      if (!l.bu) continue;
      porBu.set(l.bu, [...(porBu.get(l.bu) ?? []), l]);
    }

    const { data: gestores } = await sb.from("user_roles")
      .select("role, profiles!inner(email, full_name, squad, access_status)")
      .in("role", ["coordenador", "manager"]);

    const resultado: Record<string, string> = {};
    for (const [bu, linhas] of porBu) {
      const dest = [...new Set(((gestores ?? []) as any[])
        .map((g) => g.profiles)
        .filter((p) => p?.email && p.access_status === "ativo" && Array.isArray(p.squad) && p.squad.includes(bu))
        .map((p) => String(p.email).toLowerCase()))];
      if (dest.length === 0) { resultado[bu] = "sem destinatário"; continue; }

      const { data: ja } = await sb.from("resumo_semanal_closers_envios")
        .select("status").eq("semana_inicio", inicio).eq("bu", bu).maybeSingle();
      if (ja?.status === "enviado") { resultado[bu] = "já enviado"; continue; }
      await sb.from("resumo_semanal_closers_envios")
        .upsert({ semana_inicio: inicio, bu, destinatarios: dest, status: "pendente", updated_at: new Date().toISOString() }, { onConflict: "semana_inicio,bu" });

      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          sender: { name: "MCF Gestão", email: "marketing@minhacasafinanciada.com" },
          to: dest.map((email) => ({ email })),
          subject: `Resumo semanal dos closers — ${BU_NOME[bu] ?? bu} — ${br(inicio)} a ${br(fim)}`,
          htmlContent: html(bu, inicio, fim, linhas),
          tags: ["resumo-semanal-closers"],
        }),
      });
      const corpo = await r.text();
      await sb.from("resumo_semanal_closers_envios").update({
        status: r.ok ? "enviado" : "erro", erro: r.ok ? null : corpo.slice(0, 500), updated_at: new Date().toISOString(),
      }).eq("semana_inicio", inicio).eq("bu", bu);
      resultado[bu] = r.ok ? `enviado (${dest.length})` : `erro ${r.status}`;
    }
    console.log("[resumo-semanal-closers]", inicio, fim, resultado);
    return json({ inicio, fim, resultado });
  } catch (e) {
    console.error("[resumo-semanal-closers]", String(e).slice(0, 300));
    return json({ error: "Falha ao montar o resumo." }, 500);
  }
});
