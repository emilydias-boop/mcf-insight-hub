/** Regras puras da importação da carteira Harvey → BU Pós Venda. */
export const HARVEY_TAG = 'Migrado do Harvey';
export const HARVEY_ORIGEM = 'HARVEY_MCF';

export type Row = Record<string, string>;

export const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');

export const normCpf = (s?: string | null) => {
  let v = (s ?? '').trim();
  if (v.endsWith('.0')) v = v.slice(0, -2);
  v = digits(v);
  return v && v.length <= 11 ? v.padStart(11, '0') : v;
};

/** Últimos 9 dígitos do telefone (padrão de dedupe do CRM). */
export const phoneSuffix = (s?: string | null) => {
  const d = digits(s);
  return d.length >= 9 ? d.slice(-9) : '';
};

export const normName = (s?: string | null) =>
  (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/).filter(Boolean);

/** Telefone só reaproveita contato se o primeiro nome bater. */
export const sameFirstName = (a?: string | null, b?: string | null) => {
  const x = normName(a)[0];
  const y = normName(b)[0];
  return !!x && x === y;
};

/** Um card por cliente: mantém a linha mais recente (entrada_carteira; empate → última do arquivo). */
export const dedupeClientes = (rows: Row[]): Row[] => {
  const map = new Map<string, { r: Row; i: number }>();
  rows.forEach((r, i) => {
    const id = r.harvey_cliente_id;
    if (!id) return;
    const cur = map.get(id);
    if (!cur || (r.entrada_carteira ?? '') >= (cur.r.entrada_carteira ?? '')) map.set(id, { r, i });
  });
  return [...map.values()].sort((a, b) => a.i - b.i).map((v) => v.r);
};

const nz = (v?: string | null) => {
  const t = (v ?? '').trim();
  return t ? t : undefined;
};

export const buildCustomFields = (r: Row) => {
  const qtd = Number(r.qtd_encaminhamentos || 0);
  const cf: Record<string, unknown> = {
    origem: HARVEY_ORIGEM,
    harvey_cliente_id: r.harvey_cliente_id,
    harvey_crm_id: nz(r.crm_id),
    stage_harvey: nz(r.stage_nome),
    prioridade: nz(r.prioridade),
    entrada_carteira: nz(r.entrada_carteira),
    encaminhamentos_areas: nz(r.encaminhamentos_areas),
    qtd_encaminhamentos: qtd > 0 ? qtd : undefined,
    cpf: nz(normCpf(r.cliente_cpf)),
  };
  Object.keys(cf).forEach((k) => cf[k] === undefined && delete cf[k]);
  return cf;
};

/** Mescla só chaves ausentes/vazias (nunca sobrescreve). */
export const fillMissing = (base: Record<string, unknown> | null | undefined, add: Record<string, unknown>) => {
  const out: Record<string, unknown> = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(add)) {
    if (out[k] === undefined || out[k] === null || out[k] === '') out[k] = v;
  }
  return out;
};

export const buildTags = (r: Row) => {
  const t = (r.tags ?? '').split(';').map((s) => s.trim()).filter(Boolean);
  if (!t.includes(HARVEY_TAG)) t.push(HARVEY_TAG);
  return t;
};

export const addTag = (tags: string[] | null | undefined) => {
  const t = [...(tags ?? [])];
  return t.some((x) => String(x).includes(HARVEY_TAG)) ? t : [...t, HARVEY_TAG];
};

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const atividadeDescricao = (a: Row) => `[${cap(a.tipo)} — Harvey] ${a.descricao ?? ''}`.trim();

export const encaminhamentoDescricao = (e: Row) => {
  let d = `[Encaminhamento — Harvey] Área: ${e.area_destino || '—'} · status: ${e.status || '—'}`;
  if (nz(e.motivo)) d += ` · motivo: ${e.motivo.trim()}`;
  if (nz(e.notas)) d += `\n${e.notas.trim()}`;
  return d;
};
