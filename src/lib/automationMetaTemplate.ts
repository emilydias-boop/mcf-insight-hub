import type { TemplateButton } from "@/hooks/useAutomationTemplates";

// {{nome}}, {{ data_hora }}… (variável nomeada das automações). Sempre usar com matchAll/replace, nunca com .test (é global).
const RE_VAR = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export type ErrosMeta = Record<string, string>;
export type BotaoMeta =
  | { tipo: "QUICK_REPLY"; texto: string }
  | { tipo: "URL"; texto: string; url: string; exemplo?: string }
  | { tipo: "PHONE_NUMBER"; texto: string; telefone: string };

/** "Confirmação Reunião — MCF" -> "confirmacao_reuniao_mcf" (regra da Meta: ^[a-z0-9_]{1,512}$). */
export function slugMeta(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 512);
}

/** "boa_vindas" -> "boa_vindas_v2"; "boa_vindas_v2" -> "boa_vindas_v3". Para reenviar template recusado. */
export function proximoNomeMeta(nome: string): string {
  const m = nome.match(/^(.*)_v(\d+)$/);
  return m ? `${m[1]}_v${Number(m[2]) + 1}` : `${nome}_v2`;
}

// Status em que a Meta já não tem o template ativo com esse nome: dá para (re)enviar com outro nome.
const STATUS_REENVIO = ["REJECTED", "DELETED", "PENDING_DELETION"];

/** Pode (re)enviar para a Meta: sem vínculo, recusado/excluído, ou vinculado mas sem linha no espelho (linha da RPC com status nulo). */
export function podeEnviarParaMeta(metaNome: string | null | undefined, linha: { status: string | null } | undefined): boolean {
  if (!metaNome) return true;
  const s = (linha?.status ?? "").toUpperCase();
  return STATUS_REENVIO.includes(s) || (linha !== undefined && linha.status === null);
}

/** Badge do status da Meta. Usado no editor e na lista; nunca indexar um mapa de status sem fallback. */
export function statusMetaVisual(temNome: boolean, status: string | null): { label: string; cls: string } {
  if (!temNome) return { label: "Não enviado para a Meta", cls: "" };
  if (status === null) return { label: "Não encontrado na Meta", cls: "" };
  const s = status.toUpperCase();
  const verde = "bg-success/15 text-success border-success/30";
  const amarelo = "bg-warning/15 text-warning border-warning/30";
  const vermelho = "bg-destructive/15 text-destructive border-destructive/30";
  const m: Record<string, { label: string; cls: string }> = {
    APPROVED: { label: "Aprovado", cls: verde },
    PENDING: { label: "Em análise", cls: amarelo },
    IN_APPEAL: { label: "Em recurso", cls: amarelo },
    REJECTED: { label: "Recusado", cls: vermelho },
    PAUSED: { label: "Pausado", cls: vermelho },
    DISABLED: { label: "Desativado", cls: vermelho },
    DELETED: { label: "Excluído na Meta", cls: "" },
    PENDING_DELETION: { label: "Excluído na Meta", cls: "" },
  };
  return m[s] ?? { label: s, cls: "" };
}

/** Variáveis nomeadas na ordem da 1ª aparição no texto (repetida conta uma vez). */
export function variaveisDoTexto(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(RE_VAR)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** O que vai para automation_templates.variables: as do corpo na ordem do texto, depois as das URLs dos botões. */
export function variaveisDoTemplate(content: string, botoes: TemplateButton[]): string[] {
  const out = variaveisDoTexto(content);
  for (const b of botoes) {
    if (b.type !== "url") continue;
    for (const v of variaveisDoTexto(b.url ?? "")) if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** {{nome}} -> {{1}}, {{data_hora}} -> {{2}}… na ordem em que aparecem; a mesma variável repetida reaproveita o número. */
export function corpoParaMeta(content: string): { corpo: string; ordem: string[] } {
  const ordem = variaveisDoTexto(content);
  const corpo = content.trim().replace(RE_VAR, (_m, nome: string) => `{{${ordem.indexOf(nome) + 1}}}`);
  return { corpo, ordem };
}

const soTelefone = (s: string) => s.replace(/[\s()-]/g, "");

/** buttons_config -> botoes da edge meta-wa-templates. Variável nomeada no fim da URL vira {{1}} do botão. */
export function botoesParaMeta(botoes: TemplateButton[], exemplosUrl: Record<number, string>): BotaoMeta[] {
  return botoes.map((b, i): BotaoMeta => {
    const texto = b.text.trim();
    if (b.type === "quick_reply") return { tipo: "QUICK_REPLY", texto };
    if (b.type === "phone") return { tipo: "PHONE_NUMBER", texto, telefone: soTelefone(b.phone ?? "") };
    const url = (b.url ?? "").trim();
    return variaveisDoTexto(url).length > 0
      ? { tipo: "URL", texto, url: url.replace(RE_VAR, "{{1}}"), exemplo: (exemplosUrl[i] ?? "").trim() }
      : { tipo: "URL", texto, url };
  });
}

/** Base da URL antes da variável final, para pedir/validar o exemplo. null se a URL não tem variável. */
export function baseUrlVariavel(url: string): string | null {
  const u = url.trim();
  return variaveisDoTexto(u).length > 0 ? u.replace(/\{\{[^{}]*\}\}$/, "") : null;
}

/** Mesma régua da edge meta-wa-templates, para recusar antes de chamar a Meta. */
export function validarParaMeta(f: {
  nomeMeta: string; categoria: string; content: string; botoes: TemplateButton[];
  exemplos: Record<string, string>; exemplosUrl: Record<number, string>;
}): ErrosMeta {
  const e: ErrosMeta = {};
  if (!/^[a-z0-9_]{1,512}$/.test(f.nomeMeta)) e.nomeMeta = "Use só letras minúsculas, números e _.";
  if (f.categoria !== "utility" && f.categoria !== "marketing") e.categoria = "Na Meta, só Utilidade ou Marketing.";

  const texto = f.content.trim();
  if (!texto) e.content = "Escreva o conteúdo da mensagem.";
  else if (texto.length > 1024) e.content = "Até 1024 caracteres.";
  else if (/\{\{\s*\d+\s*\}\}/.test(texto)) e.content = "Use variáveis com nome, como {{nome}}. O número ({{1}}) é gerado sozinho.";
  else if (texto.replace(RE_VAR, "").includes("{{") || texto.replace(RE_VAR, "").includes("}}")) e.content = "Há chaves {{ }} soltas ou variável com nome inválido.";
  else if (/^\{\{[^{}]*\}\}/.test(texto) || /\{\{[^{}]*\}\}$/.test(texto)) e.content = "A mensagem não pode começar nem terminar com uma variável.";
  else if (/\}\}\s*\{\{/.test(texto)) e.content = "Duas variáveis coladas: ponha texto entre elas.";
  if (!e.content) {
    for (const v of variaveisDoTexto(texto)) {
      const ex = (f.exemplos[v] ?? "").trim();
      if (!ex) e[`exemplo_${v}`] = "Exemplo obrigatório.";
      else if (ex.length > 200) e[`exemplo_${v}`] = "Até 200 caracteres.";
      else if (ex.includes("{{")) e[`exemplo_${v}`] = "O exemplo não pode ter {{.";
    }
  }

  const qr = f.botoes.filter(b => b.type === "quick_reply").length;
  const urls = f.botoes.filter(b => b.type === "url").length;
  const fones = f.botoes.filter(b => b.type === "phone").length;
  if (f.botoes.length > 3) e.botoes = "No máximo 3 botões.";
  else if (qr > 0 && urls + fones > 0) e.botoes = "Não misture resposta rápida com link ou telefone.";
  else if (urls > 2) e.botoes = "No máximo 2 botões de link.";
  else if (fones > 1) e.botoes = "No máximo 1 botão de telefone.";

  f.botoes.forEach((b, i) => {
    const t = b.text.trim();
    if (!t) e[`botao_${i}_texto`] = "Texto obrigatório.";
    else if (t.length > 25) e[`botao_${i}_texto`] = "Até 25 caracteres.";
    else if (t.includes("{{")) e[`botao_${i}_texto`] = "O texto do botão não pode ter variável.";
    if (b.type === "url") {
      const url = (b.url ?? "").trim();
      const qtd = (url.match(/\{\{/g) ?? []).length;
      if (!/^https:\/\/\S+$/.test(url)) e[`botao_${i}_url`] = "A URL precisa começar com https://";
      else if (/\{\{\s*\d+\s*\}\}/.test(url)) e[`botao_${i}_url`] = "Use variável com nome, como {{wa_agendar_token}}.";
      else if (qtd > 1) e[`botao_${i}_url`] = "No máximo 1 variável no botão.";
      else if (qtd === 1 && !/\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}$/.test(url)) e[`botao_${i}_url`] = "A variável precisa ficar no final da URL.";
      const base = baseUrlVariavel(url);
      if (!e[`botao_${i}_url`] && base !== null) {
        const ex = (f.exemplosUrl[i] ?? "").trim();
        if (!/^https:\/\/\S+$/.test(ex) || !ex.startsWith(base) || ex.length <= base.length || ex.includes("{{")) {
          e[`botao_${i}_exemplo`] = `Informe a URL completa de exemplo, começando com ${base}`;
        }
      }
    }
    if (b.type === "phone" && !/^\+[1-9]\d{7,14}$/.test(soTelefone(b.phone ?? ""))) {
      e[`botao_${i}_telefone`] = "Use o formato +55 com DDD, ex.: +5511999999999.";
    }
  });
  return e;
}

/** campo devolvido pela edge (400) -> chave de ErrosMeta. */
export function campoDaEdge(campo: string | undefined, ordem: string[]): string | null {
  if (!campo) return null;
  if (campo === "nome") return "nomeMeta";
  if (campo === "corpo") return "content";
  if (campo === "categoria" || campo === "botoes") return campo;
  const ex = campo.match(/^exemplos\[(\d+)\]$/);
  if (ex) return ordem[Number(ex[1])] ? `exemplo_${ordem[Number(ex[1])]}` : null;
  const bt = campo.match(/^botoes\[(\d+)\]\.(texto|url|exemplo|telefone)$/);
  if (bt) return `botao_${bt[1]}_${bt[2]}`;
  return null;
}

/** Lê {error, campo} e o status HTTP de um erro de supabase.functions.invoke. */
export async function lerErroEdge(error: unknown): Promise<{ status?: number; mensagem: string; campo?: string }> {
  const ctx = (error as { context?: Response })?.context;
  let corpo: { error?: string; campo?: string } = {};
  let status: number | undefined;
  if (ctx && typeof ctx.json === "function") { status = ctx.status; try { corpo = await ctx.json(); } catch { /* sem corpo */ } }
  // Sem corpo.error, o error.message do supabase-js vem em inglês ("Edge Function returned a non-2xx status code").
  const msg = status === 401 ? "Sessão expirada. Entre de novo."
    : status === 403 ? "Sem permissão para esta ação."
    : status ? `Não foi possível concluir a ação (erro ${status}).`
    : "Sem conexão com o servidor. Tente de novo.";
  return { status, mensagem: corpo.error && status !== 401 ? corpo.error : msg, campo: corpo.campo };
}
