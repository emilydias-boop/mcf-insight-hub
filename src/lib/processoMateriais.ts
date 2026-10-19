export const MATERIAL_STATUS = [
  { value: "pronto", label: "Pronto", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "em_teste", label: "Em teste", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "rascunho", label: "Rascunho", cls: "bg-purple-100 text-purple-800 border-purple-200" },
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

/** Monta { etapa_chave: [[titulo, status], ...] } a partir das linhas já ordenadas. */
export function agruparMateriais(rows: { titulo: string; status: string; etapa_chave: string }[]) {
  const out: Record<string, [string, string][]> = {};
  for (const r of rows) (out[r.etapa_chave] ??= []).push([r.titulo, r.status]);
  return out;
}

/** Insere window.__MATERIAIS__ antes da primeira <script>, escapando "<". */
export function injetarMateriais(html: string, dados: unknown) {
  const json = JSON.stringify(dados).replace(/</g, "\\u003c");
  const i = html.indexOf("<script");
  if (i < 0) return html;
  return html.slice(0, i) + `<script>window.__MATERIAIS__=${json};</script>` + html.slice(i);
}
