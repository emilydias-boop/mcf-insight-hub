// Resumo da anamnese (sem IA): regra pura de apresentação a partir de lead_profiles.

export type AnamneseProfile = Record<string, unknown> | null | undefined;
export type Qualificacao = Record<string, unknown> | null | undefined;

export interface ResumoAlerta { tom: 'vermelho' | 'ambar'; texto: string }
export interface ResumoLinha { rotulo: string; valor: string; qualificacao?: string }
export interface ResumoAnamnese {
  preenchidaEm: string;
  perfil: string;
  texto: string;
  alertas: ResumoAlerta[];
  linhas: ResumoLinha[];
}

const CAMPOS_GATILHO = ['renda_bruta', 'profissao', 'situacao_credito', 'ja_constroi', 'faixa_aporte', 'experiencia_imobiliaria', 'objetivos_principais'];

const temValor = (v: unknown) =>
  v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === '') && !(Array.isArray(v) && v.length === 0);
const str = (v: unknown) => (temValor(v) ? String(v).trim() : '');

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const num = (v: unknown): number | null => {
  if (!temValor(v)) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function normalizarFonteRenda(v: unknown): string {
  const s = str(v);
  if (!s) return '';
  const k = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, ' ').trim();
  if (k === 'clt') return 'CLT';
  if (k === 'salario') return 'Salário';
  if (k === 'pro labore' || k === 'prolabore') return 'Pró-labore';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const JA_CONSTROI: Record<string, string> = { nunca: 'Nunca construiu', sim_ja: 'Já construiu', em_andamento: 'Tem obra em andamento' };
const EXPERIENCIA: Record<string, string> = { nenhuma: 'nenhuma', moradia: 'construiu para morar', investidor: 'investidor', profissional: 'profissional' };
const OBJETIVOS: Record<string, string> = {
  construcao_venda: 'Construir para vender', renda_passiva: 'Renda passiva', construir_para_cliente: 'Construir para clientes',
  leilao_imobiliario: 'Leilão de imóveis', intermediar_credito: 'Intermediar crédito', dividendos_imobiliarios: 'Dividendos imobiliários',
};
const URGENCIA: Record<string, string> = { imediata: 'Quer começar já', '1_3': 'Em 1 a 3 meses', '3_6': 'Em 3 a 6 meses', sem_pressa: 'Sem pressa' };

// Rótulos usados só no texto corrido do SDR.
const EXPERIENCIA_TEXTO: Record<string, string> = { nenhuma: 'nenhuma', moradia: 'para moradia', investidor: 'como investidor', profissional: 'profissional' };
const URGENCIA_TEXTO: Record<string, string> = { imediata: 'quer começar já', '1_3': 'quer começar em 1 a 3 meses', '3_6': 'quer começar em 3 a 6 meses', sem_pressa: 'sem pressa' };

const minuscula = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const capitalizar = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "BA - Capim Grosso" → "Capim Grosso (BA)"; outros formatos passam sem mudança. */
function cidadeTexto(v: unknown): string {
  const s = str(v);
  if (!s) return '';
  const m = s.match(/^([A-Za-z]{2})\s*[-–]\s*(.+)$/);
  return m ? `${m[2].trim()} (${m[1].toUpperCase()})` : s;
}

/** Texto corrido (2 a 4 frases, regra pura): só o que existe no cadastro. */
function montarTexto(p: Record<string, unknown>, agora: Date): string {
  const frases: string[] = [];

  const cidade = cidadeTexto(p.estado_cidade);
  const anos = idade(p.data_nascimento, agora);
  const quem = [str(p.profissao), anos !== null ? `${anos} anos` : '', cidade ? `de ${cidade}` : ''].filter(Boolean).join(', ');
  if (quem) frases.push(`${quem}.`);

  const renda = num(p.renda_bruta);
  if (renda !== null) {
    const fonte = normalizarFonteRenda(p.fonte_renda);
    const emp = typeof p.is_empresario === 'boolean' ? (p.is_empresario ? 'é empresário' : 'não é empresário') : '';
    frases.push([`Renda de ${brl(renda)}${fonte ? ` (${fonte})` : ''}`, emp].filter(Boolean).join(', ') + '.');
  }

  const jc = str(p.ja_constroi);
  const ex = str(p.experiencia_imobiliaria);
  const exp = [jc ? JA_CONSTROI[jc] ?? jc : '', ex ? `experiência ${EXPERIENCIA_TEXTO[ex] ?? ex}` : ''].filter(Boolean).join(', ');
  if (exp) frases.push(`${exp}.`);

  const objs = listar(p.objetivos_principais).map((o) => minuscula(OBJETIVOS[o] ?? o));
  const meta = num(p.renda_passiva_meta);
  const quer = [objs.length ? `Quer ${objs.join(' e ')}` : '', meta !== null ? `com meta de renda passiva de ${brl(meta)}` : ''].filter(Boolean).join(', ');
  if (quer) frases.push(`${quer}.`);

  const fa = num(p.faixa_aporte);
  const u = str(p.urgencia_operacao);
  const aporte = fa !== null ? `Faixa de aporte de ${brl(fa)} mil` : '';
  const prazo = u ? URGENCIA_TEXTO[u] ?? u : '';
  if (aporte && prazo) frases.push(`${aporte}, ${prazo}.`);
  else if (aporte) frases.push(`${aporte}.`);
  else if (prazo) frases.push(`${capitalizar(prazo)}.`);

  return frases.join(' ');
}

function dataSP(iso: unknown): string {
  const s = str(iso);
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(d);
}

function idade(nasc: unknown, agora: Date): number | null {
  const s = str(nasc);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  let a = agora.getFullYear() - y;
  if (agora.getMonth() + 1 < mo || (agora.getMonth() + 1 === mo && agora.getDate() < d)) a--;
  return a >= 0 && a < 130 ? a : null;
}

const listar = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : str(v) ? str(v).split(/[,;]/).map((x) => x.trim()).filter(Boolean) : [];

export function montarResumoAnamnese(profile: AnamneseProfile, qualificacao?: Qualificacao, agora: Date = new Date()): ResumoAnamnese | null {
  if (!profile || !CAMPOS_GATILHO.some((c) => temValor(profile[c]))) return null;
  const p = profile;

  const alertas: ResumoAlerta[] = [];
  const cred = str(p.situacao_credito).toLowerCase();
  if (cred === 'negativado') alertas.push({ tom: 'vermelho', texto: 'Crédito negativado' });
  if (p.possui_divida === true) alertas.push({ tom: 'vermelho', texto: 'Tem dívida' });
  if (str(p.tentou_financiamento).toLowerCase() === 'recusado') alertas.push({ tom: 'vermelho', texto: 'Já teve financiamento recusado' });
  if (cred === 'restricao_leve') alertas.push({ tom: 'ambar', texto: 'Restrição leve no crédito' });
  if (cred === 'nao_sei') alertas.push({ tom: 'ambar', texto: 'Não sabe a situação do crédito' });

  const id = idade(p.data_nascimento, agora);
  const perfil = [str(p.profissao), id !== null ? `${id} anos` : '', str(p.estado_cidade)].filter(Boolean).join(' · ');

  const q = qualificacao ?? {};
  const linhas: ResumoLinha[] = [];
  const add = (rotulo: string, valor: string, qual?: unknown) => {
    if (!valor) return;
    const l: ResumoLinha = { rotulo, valor };
    if (str(qual)) l.qualificacao = str(qual);
    linhas.push(l);
  };

  const renda = num(p.renda_bruta);
  add('Renda', [renda !== null ? brl(renda) : '', normalizarFonteRenda(p.fonte_renda)].filter(Boolean).join(' · '), q.renda);

  if (typeof p.is_empresario === 'boolean') add('Empresário', [p.is_empresario ? 'Sim' : 'Não', str(p.porte_empresa)].filter(Boolean).join(' · '));

  const jc = str(p.ja_constroi);
  const ex = str(p.experiencia_imobiliaria);
  add('Experiência', [jc ? JA_CONSTROI[jc] ?? jc : '', ex ? EXPERIENCIA[ex] ?? ex : ''].filter(Boolean).join(' · '), q.constroi_venda);

  const fa = num(p.faixa_aporte);
  add('Aporte', fa !== null ? `Faixa de R$ ${fa.toLocaleString('pt-BR')} mil` : str(p.faixa_aporte_descricao));

  const objs = listar(p.objetivos_principais).map((o) => OBJETIVOS[o] ?? o).join(', ');
  const meta = num(p.renda_passiva_meta);
  add('Objetivo', [objs, meta !== null ? `meta ${brl(meta)}` : ''].filter(Boolean).join(' · '));

  const u = str(p.urgencia_operacao);
  add('Urgência', u ? URGENCIA[u] ?? u : '');

  return { preenchidaEm: dataSP(p.data_cadastro) || dataSP(p.created_at), perfil, texto: montarTexto(p, agora), alertas, linhas };
}
