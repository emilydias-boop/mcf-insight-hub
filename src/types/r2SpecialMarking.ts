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
    if (norm(rule.closer_r1_name) !== r1) continue;
    if (rule.required_channel && rule.required_channel !== channelKey) continue;
    if (rule.require_contract_paid && !input.isContractPaid) continue;
    if (rule.valid_from && refYmd && refYmd < rule.valid_from.slice(0, 10)) continue;
    if (rule.valid_until && refYmd && refYmd > rule.valid_until.slice(0, 10)) continue;
    return rule;
  }
  return null;
}