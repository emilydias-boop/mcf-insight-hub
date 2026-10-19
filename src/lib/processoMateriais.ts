export const MATERIAL_STATUS = [
  { value: "pronto", label: "Pronto", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "em_teste", label: "Em teste", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "rascunho", label: "Rascunho", cls: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "falta_anexar", label: "Falta anexar", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "falta_fazer", label: "Falta fazer", cls: "bg-red-100 text-red-800 border-red-200" },
  { value: "a_confirmar", label: "A confirmar", cls: "bg-amber-100 text-amber-800 border-amber-200" },
] as const;

export const MATERIAL_TIPOS: Record<string, string> = {
  email: "E-mail", whatsapp: "WhatsApp", sms: "SMS", pdf: "PDF", video: "Vídeo", canva: "Canva",
  apresentacao: "Apresentação", planilha: "Planilha", roteiro: "Roteiro", fisico: "Físico",
  sistema: "Sistema", outro: "Outro",
};

export const statusInfo = (s: string) => MATERIAL_STATUS.find((x) => x.value === s) ?? MATERIAL_STATUS[3];

export const PROCESSO_POS_VENDA = "pos-venda";

export function temDocumento(r: { link_url?: string | null; arquivo_path?: string | null; conteudo?: string | null }) {
  return [r.link_url, r.arquivo_path, r.conteudo].some((valor) => !!valor?.trim());
}

/** Monta os itens do fluxo a partir das linhas já ordenadas. */
export function agruparMateriais(rows: { titulo: string; status: string; etapa_chave: string; id: string; link_url: string | null; arquivo_path: string | null; conteudo: string | null }[]) {
  const out: Record<string, [string, string, string, boolean][]> = {};
  for (const r of rows) (out[r.etapa_chave] ??= []).push([r.titulo, r.status, r.id, temDocumento(r)]);
  return out;
}

export function materialIdDaMensagem(event: { source: unknown; data: unknown }, origem: unknown, ids: ReadonlySet<string>) {
  if (!origem || event.source !== origem || !event.data || typeof event.data !== "object") return null;
  const data = event.data as { tipo?: unknown; id?: unknown };
  return data.tipo === "mcf-abrir-material" && typeof data.id === "string" && ids.has(data.id) ? data.id : null;
}

/** Apenas hosts conhecidos podem ser incorporados; demais URLs HTTP(S) abrem em nova aba. */
export function linkMaterial(valor: string | null): { href: string; tela?: string; embed?: string } | null {
  const link = valor?.trim();
  if (!link) return null;
  if (link.startsWith("/") && !link.startsWith("//") && !link.includes("\\")) return { href: link, tela: link };
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
  if (url.origin === "https://mcfgestao.com") return { href: link, tela: url.pathname + url.search + url.hash };
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname;
  let embed: string | undefined;
  if (host === "youtube.com" || host === "youtu.be") {
    const id = host === "youtu.be" ? path.split("/")[1] : url.searchParams.get("v") ?? path.match(/^\/embed\/([^/]+)/)?.[1];
    if (id && /^[\w-]+$/.test(id)) embed = `https://www.youtube.com/embed/${id}`;
  } else if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = path.match(/^\/(?:video\/)?(\d+)(?:\/|$)/)?.[1];
    if (id) embed = `https://player.vimeo.com/video/${id}`;
  } else if (host === "loom.com") {
    const id = path.match(/^\/(?:share|embed)\/([\w-]+)/)?.[1];
    if (id) embed = `https://www.loom.com/embed/${id}`;
  } else if (host === "drive.google.com") {
    const id = path.match(/^\/file\/d\/([\w-]+)/)?.[1];
    if (id) embed = `https://drive.google.com/file/d/${id}/preview`;
  } else if (host === "docs.google.com") {
    const match = path.match(/^\/(document|presentation|spreadsheets)\/d\/([\w-]+)/);
    if (match) embed = `https://docs.google.com/${match[1]}/d/${match[2]}/preview`;
  } else if (host === "canva.com" && /\/view\/?$/.test(path)) {
    url.searchParams.set("embed", "");
    embed = url.toString();
  }
  return { href: link, embed };
}

/** Insere window.__MATERIAIS__ antes da primeira <script>, escapando "<". */
export function injetarMateriais(html: string, dados: unknown) {
  const json = JSON.stringify(dados).replace(/</g, "\\u003c");
  const i = html.indexOf("<script");
  if (i < 0) return html;
  return html.slice(0, i) + `<script>window.__MATERIAIS__=${json};</script>` + html.slice(i);
}
