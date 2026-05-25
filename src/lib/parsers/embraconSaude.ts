// Parsers para textos copiados dos relatórios Embracon.
// Tolerantes a colunas com múltiplos espaços e a variações de cabeçalho.

function toNum(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

function toInt(s: string | undefined | null): number | null {
  const n = toNum(s);
  return n == null ? null : Math.round(n);
}

function isoDate(br: string | undefined | null): string | null {
  if (!br) return null;
  const m = br.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export interface DemonstrativoParsed {
  ativos: number | null;
  desistentes_excluidos: number | null;
  quitados: number | null;
  contemplados: number | null;
  nao_contemplados: number | null;
  bens_entregues: number | null;
  bens_distribuidos: number | null;
  bens_nao_distribuidos: number | null;
  disponibilidades_total: number | null;
  aplic_financeiras: number | null;
  valor_bens_a_entregar: number | null;
  proxima_parcela_vencimento: string | null;
  proxima_parcela_valor: number | null;
}

export function parseDemonstrativo(text: string): DemonstrativoParsed {
  const res: DemonstrativoParsed = {
    ativos: null, desistentes_excluidos: null, quitados: null, contemplados: null, nao_contemplados: null,
    bens_entregues: null, bens_distribuidos: null, bens_nao_distribuidos: null,
    disponibilidades_total: null, aplic_financeiras: null, valor_bens_a_entregar: null,
    proxima_parcela_vencimento: null, proxima_parcela_valor: null,
  };

  const normalized = normalizeForSearch(text);
  const flat = normalized.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  const participantes = flat.match(
    /Ativos\s+.*?Desis.*?Quitados\s+Contemplados\s+Nao\s+Contemp\.?\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i,
  );
  if (participantes) {
    res.ativos = toInt(participantes[1]);
    res.desistentes_excluidos = toInt(participantes[2]);
    res.quitados = toInt(participantes[3]);
    res.contemplados = toInt(participantes[4]);
    res.nao_contemplados = toInt(participantes[5]);
  }

  const bens = flat.match(
    /Bens\s+Entregues\s+Distribu(?:idos)?\s+Nao\s+Distribu(?:idos)?\s+(\d+)\s+(\d+)\s+(\d+)/i,
  );
  if (bens) {
    res.bens_entregues = toInt(bens[1]);
    res.bens_distribuidos = toInt(bens[2]);
    res.bens_nao_distribuidos = toInt(bens[3]);
  }

  const dispMatches = [...flat.matchAll(/DISPONIBILIDADES\s*\([^)]*\)\s+([\d.,]+)/gi)];
  const lastDisp = dispMatches.at(-1);
  if (lastDisp) res.disponibilidades_total = toNum(lastDisp[1]);

  const aplicMatches = [...flat.matchAll(/APLIC(?:\.|ACOES)?\s+FIN(?:ANC)?\.?\s+VINC\.?\s+CONTEMP(?:L)?\.?\s+([\d.,]+)/gi)];
  const lastAplic = aplicMatches.at(-1);
  if (lastAplic) res.aplic_financeiras = toNum(lastAplic[1]);

  const mBens = flat.match(/VALOR\s+DOS?\s+BENS?\s+A\s+ENTREGAR\s+([\d.,]+)/i);
  if (mBens) res.valor_bens_a_entregar = toNum(mBens[1]);

  const proxima = flat.match(/Proxima\s+Parcela.*?(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)/i);
  if (proxima) {
    res.proxima_parcela_vencimento = isoDate(proxima[1]);
    res.proxima_parcela_valor = toNum(proxima[2]);
  }

  return res;
}

export interface CalendarioLinha {
  grupo: string;
  numero: number;
  data_assembleia: string;
  dia_semana: string | null;
  vencimento: string | null;
  sorteio: string | null;
  horario: string | null;
}

// Formato: "007272  001  25/05/2026  Seg  20/05/2026  23/05/2026  09:00"
export function parseCalendario(text: string): CalendarioLinha[] {
  const out: CalendarioLinha[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) continue;
    const parts = l.split(/\s+/);
    // precisa pelo menos: grupo nº data dia venc sorteio hora (7)
    if (parts.length < 4) continue;
    if (!/^\d{4,7}$/.test(parts[0])) continue;
    if (!/^\d{1,3}$/.test(parts[1])) continue;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(parts[2])) continue;
    const grupo = parts[0].padStart(6, '0');
    const numero = parseInt(parts[1], 10);
    const data = isoDate(parts[2])!;
    const dia = parts[3] && /^[A-Za-zÀ-ú]{3,}$/.test(parts[3]) ? parts[3] : null;
    // localizar próximas duas datas e hora
    const rest = parts.slice(dia ? 4 : 3);
    const datas = rest.filter((p) => /^\d{2}\/\d{2}\/\d{4}$/.test(p));
    const hora = rest.find((p) => /^\d{1,2}:\d{2}$/.test(p)) || null;
    out.push({
      grupo,
      numero,
      data_assembleia: data,
      dia_semana: dia,
      vencimento: datas[0] ? isoDate(datas[0]) : null,
      sorteio: datas[1] ? isoDate(datas[1]) : null,
      horario: hora,
    });
  }
  return out;
}

export interface ResultadoLinha {
  cota: string;
  modalidade: string | null;
  bem: string | null;
  filial: string | null;
  percentual_lance: number | null;
  parcela: string | null;
  dt_contemplacao: string | null;
}

// Linhas: "0000-00  Sorteio  IE150  000316  24/04/2026  24/04/2026  0,00  000  0,0000"
// ou:     "2918-00  2o Lance Fixo  IE130  000879  ..."
const MODALIDADES = [
  '2o Lance Fixo',
  '2º Lance Fixo',
  'Lance Livre',
  'Lance Fixo',
  'Lance Limitado',
  'Lance Fidelidade',
  'Sorteio',
];

export function parseResultadoAssembleia(text: string): ResultadoLinha[] {
  const out: ResultadoLinha[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) continue;
    const mCota = l.match(/^(\d{3,4}-\d{2})\s+/);
    if (!mCota) continue;
    let rest = l.slice(mCota[0].length);
    let modalidade: string | null = null;
    for (const m of MODALIDADES) {
      if (rest.startsWith(m)) {
        modalidade = m;
        rest = rest.slice(m.length).trim();
        break;
      }
    }
    const parts = rest.split(/\s+/);
    const bem = parts[0] || null;
    const filial = parts[1] && /^\d{4,6}$/.test(parts[1]) ? parts[1] : null;
    const datas = parts.filter((p) => /^\d{2}\/\d{2}\/\d{4}$/.test(p));
    const pct = parts.find((p, idx) => idx >= parts.length - 2 && /^\d+[.,]\d+$/.test(p));
    const parcela = parts.find((p) => /^\d{3}$/.test(p)) || null;
    out.push({
      cota: mCota[1],
      modalidade,
      bem,
      filial,
      percentual_lance: pct ? toNum(pct) : null,
      parcela,
      dt_contemplacao: datas[0] ? isoDate(datas[0]) : null,
    });
  }
  return out;
}