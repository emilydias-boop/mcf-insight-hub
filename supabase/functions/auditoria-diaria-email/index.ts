import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const headers = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auditoria-cron-token",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, "Content-Type": "application/json" },
});

const BodySchema = z.object({
  p_ref: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  test_to: z.string().email().max(320).optional(),
  dry_run: z.boolean().optional().default(false),
}).strict();

type Destinatario = { email: string; nome: string };
type Relatorio = Record<string, any>;

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function hojeSP() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const v = Object.fromEntries(p.map((x) => [x.type, x.value]));
  return `${v.year}-${v.month}-${v.day}`;
}
const br = (iso: string) => iso.split("-").reverse().join("/");
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]!));
const n = (value: unknown) => Number(value ?? 0);
const pct = (value: unknown) => `${n(value).toFixed(0)}%`;
const horas = (value: unknown) => value === null || value === undefined ? "—" : `${n(value).toFixed(1).replace(".", ",")} h`;

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ticketValido(token: string) {
  if (!token) return false;
  const tokenHash = await sha256(token);
  const { data: ticket } = await sb.from("auditoria_cron_tickets").select("id")
    .eq("token_hash", tokenHash).is("consumed_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!ticket) return false;
  const { data: consumido } = await sb.from("auditoria_cron_tickets").update({ consumed_at: new Date().toISOString() })
    .eq("id", ticket.id).is("consumed_at", null).select("id").maybeSingle();
  return !!consumido;
}

async function adminValido(token: string) {
  if (!token) return false;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return false;
  const { data: papel } = await sb.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").limit(1);
  return (papel?.length ?? 0) > 0;
}

async function registrar(dataRef: string, destinatarios: Destinatario[], status: string, erro?: string) {
  const { error } = await sb.from("auditoria_envios").insert({
    data_ref: dataRef,
    destinatarios,
    status,
    erro: erro?.slice(0, 1500) ?? null,
  });
  if (error) console.error("[auditoria-diaria-email] Falha ao registrar execução:", error.message);
}

function tabela(cabecalho: string[], linhas: unknown[][], alinhamentoEsquerda = true) {
  const th = cabecalho.map((c) => `<th style="padding:7px;border:1px solid #cbd5e1;background:#eaf0f4;color:#0b3d5c;text-align:left">${esc(c)}</th>`).join("");
  const tr = linhas.map((linha) => `<tr>${linha.map((c, i) => `<td style="padding:7px;border:1px solid #cbd5e1;text-align:${alinhamentoEsquerda && i === 0 ? "left" : "right"}">${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:12px;margin:8px 0 18px"><thead><tr>${th}</tr></thead><tbody>${tr || `<tr><td colspan="${cabecalho.length}" style="padding:8px;border:1px solid #cbd5e1">Sem registros</td></tr>`}</tbody></table>`;
}
function secao(titulo: string, conteudo: string) {
  return `<h2 style="font-size:17px;color:#0b3d5c;border-bottom:2px solid #0b3d5c;padding-bottom:5px;margin:26px 0 8px">${esc(titulo)}</h2>${conteudo}`;
}

function montarHtml(dataRef: string, ns: Relatorio, li: Relatorio, ct: Relatorio) {
  const nsTotal = ns.totais ?? {};
  const liTotal = li.totais ?? {};
  const ctTotal = ct.totais ?? {};
  const diasCompletos = (ns.dias ?? []).filter((d: Relatorio) => !d.parcial && n(d.entraram) > 0);
  const piorNoShow = [...diasCompletos].sort((a, b) => n(a.percentual) - n(b.percentual) || n(b.entraram) - n(a.entraram))[0];
  const piorFilaNoShow = [...(ns.fila ?? [])].sort((a, b) => n(b.negocios) - n(a.negocios))[0];
  const piorSemInteracao = [...(li.por_dono ?? [])].sort((a, b) => n(b.sem_interacao_7d) - n(a.sem_interacao_7d))[0];
  const candidatosContato = (ct.por_dono ?? []).filter((d: Relatorio) => n(d.expediente_criados) >= 5);
  const zeroContato = candidatosContato.filter((d: Relatorio) => n(d.expediente_mesmo_dia) === 0).sort((a: Relatorio, b: Relatorio) => n(b.expediente_criados) - n(a.expediente_criados))[0];
  const referencia = [...candidatosContato].sort((a, b) => n(b.expediente_pct) - n(a.expediente_pct) || n(a.nunca_contatados) - n(b.nunca_contatados))[0];
  const noite = (ct.janelas ?? []).find((j: Relatorio) => j.janela === "apos18") ?? {};
  const fds = (ct.janelas ?? []).find((j: Relatorio) => j.janela === "fds") ?? {};

  const executivo = [
    piorNoShow ? `<b>No-show:</b> ${br(piorNoShow.dia)} teve o menor atendimento no prazo (${pct(piorNoShow.percentual)}). ${piorFilaNoShow ? `Na fila atual, ${esc(piorFilaNoShow.dono)} tem ${n(piorFilaNoShow.negocios)} sem ação.` : "Não há no-shows pendentes na fila do dia útil anterior."}` : "Não há entradas de no-show no período completo.",
    piorSemInteracao ? `<b>Maior fila sem interação:</b> ${esc(piorSemInteracao.dono)} concentra ${n(piorSemInteracao.sem_interacao_7d)} leads sem interação em sete dias.` : "Não há leads sem interação na janela de sete dias.",
    zeroContato ? `<b>Contato zerado:</b> ${esc(zeroContato.dono)} registra 0% de contato no mesmo dia em ${n(zeroContato.expediente_criados)} leads de expediente.` : "Nenhum responsável com pelo menos cinco leads de expediente está com contato zerado.",
    `<b>Cobertura fora do expediente:</b> após 18h, ${pct(noite.percentual_ate_12h)} foram contatados até 12h do próximo dia útil; em fins de semana/feriados, ${pct(fds.percentual_ate_fim)} até o fim do próximo dia útil.`,
    referencia ? `<b>Referência:</b> ${esc(referencia.dono)} lidera o contato no mesmo dia com ${pct(referencia.expediente_pct)} no expediente.` : "Não há base suficiente para definir uma referência de contato.",
  ];

  const filaMap = new Map<string, Relatorio>();
  for (const item of ns.fila ?? []) filaMap.set(item.dono, { dono: item.dono, noshow: n(item.negocios), i01: 0, i23: 0, i47: 0 });
  for (const item of li.fila ?? []) {
    const atual = filaMap.get(item.dono) ?? { dono: item.dono, noshow: 0, i01: 0, i23: 0, i47: 0 };
    atual.i01 = n(item.idade_0_1); atual.i23 = n(item.idade_2_3); atual.i47 = n(item.idade_4_7);
    filaMap.set(item.dono, atual);
  }
  const fila = [...filaMap.values()].sort((a, b) => (n(b.noshow) + n(b.i01) + n(b.i23) + n(b.i47)) - (n(a.noshow) + n(a.i01) + n(a.i23) + n(a.i47)));

  const htmlNoShow = tabela(
    ["Dia", "Entraram", "Com ação no prazo", "%", "Reagendados", "Reagendados no prazo", "Nunca trabalhados"],
    (ns.dias ?? []).map((d: Relatorio) => [`${br(d.dia)}${d.parcial ? " (parcial)" : ""}`, d.entraram, d.com_acao, pct(d.percentual), d.reagendados, d.reagendados_prazo, d.nunca_trabalhados]),
  ) + `<p><b>Total dos 14 dias úteis completos:</b> ${n(nsTotal.entraram)} no-shows; ${n(nsTotal.com_acao)} com ação (${pct(nsTotal.percentual)}); ${n(nsTotal.nunca_trabalhados)} nunca trabalhados.</p>` +
    "<h3>Ranking de quem atuou no prazo</h3>" + tabela(["Colaborador", "Negócios", "Ações"], (ns.ranking ?? []).map((r: Relatorio) => [r.nome, r.negocios, r.acoes])) +
    "<h3>Estoque atual parado em No-Show</h3>" + tabela(["Faixa de idade", "Negócios"], (ns.estoque ?? []).map((r: Relatorio) => [r.faixa, r.negocios]));

  const htmlSemInteracao = tabela(
    ["Dono atual", "Criados 7d", "Sem interação 7d", "Criados 30d", "Sem interação 30d", "Idade média (dias)"],
    (li.por_dono ?? []).map((r: Relatorio) => [r.dono, r.criados_7d, r.sem_interacao_7d, r.criados_30d, r.sem_interacao_30d, r.idade_media_dias ?? "—"]),
  ) + `<p><b>Total:</b> ${n(liTotal.sem_interacao_7d)} de ${n(liTotal.criados_7d)} leads sem interação em sete dias (${pct(liTotal.percentual_7d)}).</p>` +
    "<h3>Primeiro a atuar e interações</h3>" + tabela(["Colaborador", "1º a atuar 7d", "1º a atuar 30d", "Interações 7d", "Interações 30d"], (li.colaboradores ?? []).map((r: Relatorio) => [r.nome, r.primeiro_7d, r.primeiro_30d, r.interacoes_7d, r.interacoes_30d]));

  const nomeJanela: Record<string, string> = { expediente: "Expediente (8h–18h)", antes8: "Antes das 8h", apos18: "Depois das 18h", fds: "Fim de semana / feriado" };
  const htmlContato = tabela(
    ["Janela de entrada", "Criados", "Mesmo dia", "%", "Até 12h do próximo útil", "%", "Até fim do próximo útil", "%", "Nunca", "Mediana"],
    (ct.janelas ?? []).map((r: Relatorio) => [nomeJanela[r.janela] ?? r.janela, r.criados, r.contato_mesmo_dia, pct(r.percentual_mesmo_dia), r.janela === "apos18" ? r.ate_12h_proximo : "—", r.janela === "apos18" ? pct(r.percentual_ate_12h) : "—", r.janela === "fds" ? r.ate_fim_proximo : "—", r.janela === "fds" ? pct(r.percentual_ate_fim) : "—", r.nunca_contatados, horas(r.mediana_horas)]),
  ) + `<p><b>Total:</b> ${n(ctTotal.contato_mesmo_dia)} de ${n(ctTotal.criados)} contatados no mesmo dia (${pct(ctTotal.percentual_mesmo_dia)}); ${n(ctTotal.nunca_contatados)} nunca contatados.</p>` +
    "<h3>Contato no mesmo dia por data de entrada</h3>" + tabela(["Dia", "Criados", "Contato no mesmo dia", "%"], (ct.por_dia ?? []).map((r: Relatorio) => [br(r.dia), r.criados, r.contato_mesmo_dia, pct(r.percentual)])) +
    "<h3>Por dono atual</h3>" + tabela(["Dono", "Expediente", "Mesmo dia", "%", "Após 18h: até 12h", "%", "FDS/feriado: no prazo", "%", "Nunca", "Mediana"], (ct.por_dono ?? []).map((r: Relatorio) => [r.dono, r.expediente_criados, r.expediente_mesmo_dia, r.expediente_pct === null ? "—" : pct(r.expediente_pct), `${n(r.apos18_ate_12h)}/${n(r.apos18_criados)}`, r.apos18_pct === null ? "—" : pct(r.apos18_pct), `${n(r.fds_ate_fim)}/${n(r.fds_criados)}`, r.fds_pct === null ? "—" : pct(r.fds_pct), r.nunca_contatados, horas(r.mediana_horas)]));

  const criterios = `<ul style="font-size:12px;line-height:1.55;color:#444">
    <li>BU Incorporador MCF = origens mapeadas Inside Sales e Piloto; No-Show considera as etapas das duas origens.</li>
    <li>Interação: mudança de etapa, nota, tarefa concluída, ligação ou agendamento com pessoa identificada. Trocas automáticas/de dono não contam.</li>
    <li>Contato D0: somente click-to-call, “Registrar contato” ou ligação Sonax. Ações nos dois minutos após a entrada no No-Show são descartadas nas verificações de no-show.</li>
    <li>Identidade unificada por e-mail; nomes vêm do cadastro mais recente. Prazos usam America/Sao_Paulo e o calendário nacional de feriados.</li>
    <li>Ações fora do horário contam; prazo é o próximo dia útil. O dia de referência é parcial e não entra no total dos 14 dias úteis completos.</li>
    <li>Limitação: contatos por canais pessoais ou fora do sistema não deixam rastro e podem aparecer como “nunca contatados”. Nenhum dado pessoal de lead é incluído.</li>
  </ul>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f5f7;font-family:Arial,sans-serif;color:#222"><div style="max-width:900px;margin:0 auto;padding:22px;background:#fff">
    <h1 style="font-size:22px;color:#0b3d5c;margin:0 0 8px">Auditoria Diária Comercial · BU Incorporador MCF · ${br(dataRef)}</h1>
    <p style="font-size:14px;line-height:1.5">Hoje: <b>${pct(nsTotal.percentual)}</b> dos no-shows tiveram ação no prazo; <b>${pct(liTotal.percentual_7d)}</b> dos leads de sete dias estão sem interação; <b>${pct(ctTotal.percentual_mesmo_dia)}</b> dos leads foram contatados no mesmo dia.</p>
    ${secao("Resumo executivo", `<ol style="font-size:13px;line-height:1.55;padding-left:22px">${executivo.map((x) => `<li style="margin-bottom:8px">${x}</li>`).join("")}</ol>`)}
    ${secao("Fila de cobrança de hoje", tabela(["Dono atual", "No-shows sem ação", "Leads 0–1 dia", "Leads 2–3 dias", "Leads 4–7 dias", "Total"], fila.map((f) => [f.dono, f.noshow, f.i01, f.i23, f.i47, n(f.noshow) + n(f.i01) + n(f.i23) + n(f.i47)])))}
    ${secao("Verificação 1 — No-shows", htmlNoShow)}
    ${secao("Verificação 2 — Leads sem interação", htmlSemInteracao)}
    ${secao("Verificação 3 — Contato no dia da entrada", htmlContato)}
    ${secao("Critérios e limitações", criterios)}
    <p style="font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:12px">Relatório automático MCF Gestão. Gerado em ${esc(new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))} (São Paulo).</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let dataRef = hojeSP();
  let testTo: string | undefined;
  let dryRun = false;
  try {
    const ticket = req.headers.get("x-auditoria-cron-token") ?? "";
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^bearer\s+/i, "").trim();
    if (!(await ticketValido(ticket)) && !(await adminValido(bearer))) return json({ error: "Não autorizado" }, 401);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Parâmetros inválidos", details: parsed.error.flatten() }, 400);
    dataRef = parsed.data.p_ref ?? dataRef;
    testTo = parsed.data.test_to;
    dryRun = parsed.data.dry_run;

    if (!dryRun && !testTo) {
      const { data: anterior } = await sb.from("auditoria_envios").select("id").eq("data_ref", dataRef).eq("status", "enviado").maybeSingle();
      if (anterior) {
        await registrar(dataRef, [], "ignorado_duplicado");
        return json({ success: true, status: "ignorado_duplicado", data_ref: dataRef });
      }
      const { data: feriado } = await sb.from("feriados").select("nome").eq("data", dataRef).maybeSingle();
      if (feriado) {
        await registrar(dataRef, [], "pulado_feriado");
        return json({ success: true, status: "pulado_feriado", feriado: feriado.nome, data_ref: dataRef });
      }
    }

    const [nsResult, liResult, ctResult] = await Promise.all([
      sb.rpc("auditoria_noshow", { p_ref: dataRef }),
      sb.rpc("auditoria_leads_sem_interacao", { p_ref: dataRef }),
      sb.rpc("auditoria_contato_d0", { p_ref: dataRef }),
    ]);
    for (const result of [nsResult, liResult, ctResult]) if (result.error) throw result.error;
    const ns = nsResult.data as Relatorio;
    const li = liResult.data as Relatorio;
    const ct = ctResult.data as Relatorio;
    const html = montarHtml(dataRef, ns, li, ct);
    const resumo = {
      noshow_14d: n(ns.totais?.entraram),
      noshow_com_acao: n(ns.totais?.com_acao),
      noshow_pct: n(ns.totais?.percentual),
      leads_sem_interacao_7d: n(li.totais?.sem_interacao_7d),
      leads_criados_7d: n(li.totais?.criados_7d),
      contato_mesmo_dia: n(ct.totais?.contato_mesmo_dia),
      leads_contato_janela: n(ct.totais?.criados),
      contato_mesmo_dia_pct: n(ct.totais?.percentual_mesmo_dia),
    };

    if (dryRun) {
      await registrar(dataRef, [], "dry_run");
      return json({ success: true, status: "dry_run", data_ref: dataRef, resumo, html });
    }

    let destinatarios: Destinatario[];
    if (testTo) {
      destinatarios = [{ email: testTo, nome: "Thobson Motta" }];
    } else {
      const { data, error } = await sb.from("auditoria_destinatarios").select("email,nome").eq("ativo", true).order("nome");
      if (error) throw error;
      destinatarios = (data ?? []) as Destinatario[];
    }
    if (!destinatarios.length) throw new Error("Nenhum destinatário ativo");

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) throw new Error("BREVO_API_KEY não configurada");
    const subject = `Auditoria Diária Comercial · BU Incorporador MCF · ${br(dataRef)}`;
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: "MCF Gestão", email: "marketing@minhacasafinanciada.com" },
        to: destinatarios.map((d) => ({ email: d.email, name: d.nome })),
        subject,
        htmlContent: html,
        tags: ["auditoria-diaria-comercial", "incorporador"],
      }),
    });
    const corpo = await response.text();
    let messageId: string | null = null;
    try { messageId = JSON.parse(corpo)?.messageId ?? null; } catch { /* resposta sem JSON */ }

    const { error: logError } = await sb.from("automation_logs").insert(destinatarios.map((d) => ({
      channel: "email", recipient: d.email, status: response.ok ? "sent" : "failed",
      sent_at: response.ok ? new Date().toISOString() : null, content_sent: html,
      external_id: messageId, external_status: response.ok ? "sent" : String(response.status),
      error_message: response.ok ? null : corpo.slice(0, 1000),
      metadata: { subject, tags: ["auditoria-diaria-comercial", `auditoria-${dataRef}`], data_ref: dataRef, teste: !!testTo },
    })));
    if (logError) console.error("[auditoria-diaria-email] automation_logs:", logError.message);

    if (!response.ok) throw new Error(`Brevo ${response.status}: ${corpo.slice(0, 800)}`);
    await registrar(dataRef, destinatarios, testTo ? "teste" : "enviado");
    return json({ success: true, status: testTo ? "teste" : "enviado", data_ref: dataRef, destinatarios, messageId, resumo });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[auditoria-diaria-email]", message);
    await registrar(dataRef, testTo ? [{ email: testTo, nome: "Thobson Motta" }] : [], dryRun ? "erro_dry_run" : testTo ? "erro_teste" : "erro", message);
    return json({ success: false, error: message, data_ref: dataRef }, 500);
  }
});
