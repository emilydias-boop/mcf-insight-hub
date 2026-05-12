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
  created_at?: string;
  updated_at?: string;
}

export interface R2SpecialMarkingMatchInput {
  channel: 'ANAMNESE' | 'A010' | 'Outro' | null | undefined;
  r1CloserName: string | null | undefined;
  isContractPaid: boolean;
}

const norm = (v: string | null | undefined) =>
  (v || '').toString().trim().toLowerCase();

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

  for (const rule of rules) {
    if (!rule.active) continue;
    if (norm(rule.closer_r1_name) !== r1) continue;
    if (rule.required_channel && rule.required_channel !== channelKey) continue;
    if (rule.require_contract_paid && !input.isContractPaid) continue;
    return rule;
  }
  return null;
}