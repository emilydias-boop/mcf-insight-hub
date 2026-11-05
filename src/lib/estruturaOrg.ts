import dagre from '@dagrejs/dagre';

export type Setor = { id: string; nome: string; parent_id: string | null; responsavel_employee_id: string | null; ordem: number | null };
export type Cargo = { id: string; nome: string; descricao: string | null; nivel: number | null; departamento_id: string | null; reporta_a_cargo_id: string | null; faixa_min: number | null; faixa_max: number | null };
export type Pessoa = { id: string; nome: string; gestor_id: string | null; cargo_catalogo_id: string | null; avatar_url: string | null };
export type Vinculo = { id: string; employee_id: string; cargo_id: string; departamento_id: string | null; data_inicio: string; data_fim: string | null; interino: boolean };
export type EstruturaRaw = { pode_editar: boolean; meu_employee_id: string | null; setores: Setor[]; cargos: Cargo[]; pessoas: Pessoa[]; vinculos: Vinculo[] };
export type Requisicao = { id: string; cargo_catalogo_id: string | null; departamento_id: string | null; status: string; titulo?: string | null };

export type Modo = 'setores' | 'cargos' | 'pessoas';
export type Ocupante = { pessoa: Pessoa; interino: boolean; vinculoId: string | null };

export type Modelo = {
  raw: EstruturaRaw;
  setores: Map<string, Setor>;
  cargos: Map<string, Cargo>;
  pessoas: Map<string, Pessoa>;
  ocupantes: Map<string, Ocupante[]>; // cargoId -> ocupantes na data
  cargoDaPessoa: Map<string, { cargoId: string; interino: boolean }>;
  setorDaPessoa: Map<string, string | null>;
  superior: Map<string, string | null>;
  corSetor: Map<string, number>;
};

const vigente = (v: Vinculo, d: string) => v.data_inicio <= d && (v.data_fim == null || v.data_fim >= d);

export const REQ_ABERTA = ['em_aprovacao', 'aprovada', 'em_recrutamento'];
export function rotuloRequisicao(status: string) {
  return status === 'em_recrutamento' || status === 'aprovada' ? 'Em recrutamento' : 'Vaga em aprovação';
}

/** Monta o modelo da estrutura numa data (AAAA-MM-DD). */
export function montarModelo(raw: EstruturaRaw, data: string, hoje: string): Modelo {
  const setores = new Map(raw.setores.map((s) => [s.id, s]));
  const cargos = new Map(raw.cargos.map((c) => [c.id, c]));
  const pessoas = new Map(raw.pessoas.map((p) => [p.id, p]));
  const ocupantes = new Map<string, Ocupante[]>();
  const cargoDaPessoa = new Map<string, { cargoId: string; interino: boolean }>();
  const comHistorico = new Set(raw.vinculos.map((v) => v.employee_id));

  const add = (cargoId: string, o: Ocupante) => {
    if (!cargos.has(cargoId)) return;
    const l = ocupantes.get(cargoId) ?? [];
    if (!l.some((x) => x.pessoa.id === o.pessoa.id)) l.push(o);
    ocupantes.set(cargoId, l);
    const atual = cargoDaPessoa.get(o.pessoa.id);
    if (!atual || (atual.interino && !o.interino)) cargoDaPessoa.set(o.pessoa.id, { cargoId, interino: o.interino });
  };
  for (const v of raw.vinculos) {
    const p = pessoas.get(v.employee_id);
    if (p && vigente(v, data)) add(v.cargo_id, { pessoa: p, interino: v.interino, vinculoId: v.id });
  }
  // Sem histórico: usa o cargo cadastrado só para a data atual
  if (data >= hoje) for (const p of raw.pessoas) {
    if (!comHistorico.has(p.id) && p.cargo_catalogo_id) add(p.cargo_catalogo_id, { pessoa: p, interino: false, vinculoId: null });
  }
  for (const l of ocupantes.values()) l.sort((a, b) => Number(a.interino) - Number(b.interino));

  const setorDaPessoa = new Map<string, string | null>();
  for (const p of raw.pessoas) {
    const c = cargoDaPessoa.get(p.id);
    setorDaPessoa.set(p.id, c ? cargos.get(c.cargoId)?.departamento_id ?? null : null);
  }

  const superior = new Map<string, string | null>();
  for (const p of raw.pessoas) {
    let sup: string | null = null;
    const c = cargoDaPessoa.get(p.id);
    let alvo = c ? cargos.get(c.cargoId)?.reporta_a_cargo_id ?? null : null;
    let guard = 0;
    while (alvo && !sup && guard++ < 30) {
      const occ = (ocupantes.get(alvo) ?? []).find((o) => o.pessoa.id !== p.id);
      if (occ) sup = occ.pessoa.id;
      else alvo = cargos.get(alvo)?.reporta_a_cargo_id ?? null;
    }
    if (!sup && p.gestor_id && p.gestor_id !== p.id && pessoas.has(p.gestor_id)) sup = p.gestor_id;
    superior.set(p.id, sup);
  }
  // Remove ciclos eventuais na cadeia de pessoas
  for (const id of superior.keys()) {
    const visto = new Set<string>([id]);
    let cur = superior.get(id);
    while (cur) {
      if (visto.has(cur)) { superior.set(id, null); break; }
      visto.add(cur); cur = superior.get(cur) ?? null;
    }
  }

  const corSetor = new Map<string, number>();
  const raizDe = (id: string) => { let s = setores.get(id); let g = 0; while (s?.parent_id && setores.has(s.parent_id) && g++ < 30) s = setores.get(s.parent_id); return s?.id ?? id; };
  const raizes: string[] = [];
  for (const s of raw.setores) { const r = raizDe(s.id); if (!raizes.includes(r)) raizes.push(r); }
  raw.setores.forEach((s, i) => corSetor.set(s.id, ((raizes.indexOf(raizDe(s.id)) >= 0 ? raizes.indexOf(raizDe(s.id)) : i) % 8) + 1));

  return { raw, setores, cargos, pessoas, ocupantes, cargoDaPessoa, setorDaPessoa, superior, corSetor };
}

/** Pai hierárquico de cada nó, por modo. */
export function mapaPais(m: Modelo, modo: Modo): Map<string, string | null> {
  const r = new Map<string, string | null>();
  if (modo === 'setores') for (const s of m.setores.values()) r.set(s.id, s.parent_id && m.setores.has(s.parent_id) ? s.parent_id : null);
  if (modo === 'cargos') for (const c of m.cargos.values()) r.set(c.id, c.reporta_a_cargo_id && m.cargos.has(c.reporta_a_cargo_id) ? c.reporta_a_cargo_id : null);
  if (modo === 'pessoas') for (const p of m.pessoas.values()) r.set(p.id, m.superior.get(p.id) ?? null);
  return r;
}

/** Verdadeiro se mover `id` para baixo de `novoPai` criaria um ciclo. */
export function criaCiclo(pais: Map<string, string | null>, id: string, novoPai: string | null): boolean {
  let cur = novoPai; let g = 0;
  while (cur && g++ < 200) { if (cur === id) return true; cur = pais.get(cur) ?? null; }
  return false;
}

export function caminhoAteTopo(pais: Map<string, string | null>, id: string): string[] {
  const out = [id]; let cur = pais.get(id) ?? null; let g = 0;
  while (cur && g++ < 200 && !out.includes(cur)) { out.push(cur); cur = pais.get(cur) ?? null; }
  return out;
}

export function filhosDe(pais: Map<string, string | null>) {
  const f = new Map<string, string[]>();
  for (const [id, p] of pais) if (p) f.set(p, [...(f.get(p) ?? []), id]);
  return f;
}

export function descendentes(filhos: Map<string, string[]>, id: string): string[] {
  const out: string[] = []; const st = [...(filhos.get(id) ?? [])];
  while (st.length) { const x = st.pop()!; if (out.includes(x)) continue; out.push(x); st.push(...(filhos.get(x) ?? [])); }
  return out;
}

export function profundidades(pais: Map<string, string | null>) {
  const d = new Map<string, number>();
  for (const id of pais.keys()) d.set(id, caminhoAteTopo(pais, id).length - 1);
  return d;
}

/** Recolhe por padrão os nós de profundidade 1 (mostra os dois primeiros níveis). */
export function recolhidosIniciais(pais: Map<string, string | null>): Set<string> {
  const f = filhosDe(pais); const d = profundidades(pais); const s = new Set<string>();
  for (const [id, n] of d) if (n >= 1 && (f.get(id)?.length ?? 0) > 0) s.add(id);
  return s;
}

/** Ids visíveis, dado o conjunto de recolhidos e um conjunto pré-filtrado. */
export function visiveis(pais: Map<string, string | null>, recolhidos: Set<string>, incluidos: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const id of incluidos) {
    let cur = pais.get(id) ?? null; let ok = true; let g = 0;
    while (cur && g++ < 200) { if (incluidos.has(cur) && recolhidos.has(cur)) { ok = false; break; } cur = pais.get(cur) ?? null; }
    if (ok) out.add(id);
  }
  return out;
}

export type Pos = { x: number; y: number };
export function layoutHierarquico(ids: string[], arestas: [string, string][], tam: (id: string) => { w: number; h: number }): Map<string, Pos> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 32, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) { const t = tam(id); g.setNode(id, { width: t.w, height: t.h }); }
  for (const [a, b] of arestas) if (g.hasNode(a) && g.hasNode(b)) g.setEdge(a, b);
  dagre.layout(g);
  const r = new Map<string, Pos>();
  for (const id of ids) { const n = g.node(id); const t = tam(id); r.set(id, { x: n.x - t.w / 2, y: n.y - t.h / 2 }); }
  return r;
}

export function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}
