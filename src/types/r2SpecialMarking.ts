export interface R2SpecialMarking {
  id: string;
  name: string;
  closer_r1_employee_id: string;
  closer_r1_name?: string | null;
  required_channel: 'ANAMNESE' | 'A010' | 'OUTRO' | null;
  require_contract_paid: boolean;
  bg_color: string;
  text_color: string;
  icon: string;
  badge_label: string;
  active: boolean;
  valid_from?: string | null;   // YYYY-MM-DD
  valid_until?: string | null;  // YYYY-MM-DD
  created_at?: string;
  updated_at?: string;
}

export interface R2SpecialMarkingMatchInput {
  channel: 'ANAMNESE' | 'A010' | 'Outro' | null | undefined;
  r1CloserName: string | null | undefined;
  isContractPaid: boolean;
  /** Reference date used to evaluate valid_from / valid_until (e.g. meeting scheduled_at). */
  referenceDate?: Date | string | null;
}

const norm = (v: string | null | undefined) =>
  (v || '').toString().trim().toLowerCase();

/** Tokens significativos do nome (ignora iniciais soltas e palavras curtas). */
function nameTokens(v: string | null | undefined): string[] {
  return norm(v)
    .replace(/[^a-z0-9\sáàâãéèêíïóôõöúüçñ]/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);
}

/** True se os nomes "casam": um conjunto de tokens é subconjunto do outro.
 *  Resolve casos como "Leticia Faustino" (employees) vs "Leticia Faustino C" (closers). */
function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const an = norm(a);
  const bn = norm(b);
  if (!an || !bn) return false;
  if (an === bn) return true;
  const at = nameTokens(a);
  const bt = nameTokens(b);
  if (!at.length || !bt.length) return false;
  const aSet = new Set(at);
  const bSet = new Set(bt);
  const aInB = at.every(t => bSet.has(t));
  const bInA = bt.every(t => aSet.has(t));
  return aInB || bInA;
}

function toYmd(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date && !isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return null;
}

export function matchR2SpecialMarking(
  rules: R2SpecialMarking[],
  input: R2SpecialMarkingMatchInput
): R2SpecialMarking | null {
  if (!rules?.length) return null;
  const r1 = norm(input.r1CloserName);
  if (!r1) return null;
  const channelNorm = (input.channel || '').toString().toUpperCase();
  const channelKey =
    channelNorm === 'ANAMNESE' ? 'ANAMNESE'
    : channelNorm === 'A010' ? 'A010'
    : channelNorm ? 'OUTRO' : null;

  const refYmd = toYmd(input.referenceDate ?? new Date());

  for (const rule of rules) {
    if (!rule.active) continue;
    if (!namesMatch(rule.closer_r1_name, input.r1CloserName)) continue;
    if (rule.required_channel && rule.required_channel !== channelKey) continue;
    if (rule.require_contract_paid && !input.isContractPaid) continue;
    if (rule.valid_from && refYmd && refYmd < rule.valid_from.slice(0, 10)) continue;
    if (rule.valid_until && refYmd && refYmd > rule.valid_until.slice(0, 10)) continue;
    return rule;
  }
  return null;
}