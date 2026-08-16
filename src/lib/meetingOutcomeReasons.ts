/**
 * Catálogo de motivos de desfecho de reunião (no-show).
 *
 * Fonte única da verdade — usado na Agenda (AgendaMeetingDrawer), na lista de
 * reuniões (MeetingsList) e na fila "R1 Agendadas" do Funil Consórcio.
 * Mudar a lista é mudar uma linha aqui; não existe tabela de motivos.
 */

export interface OutcomeReason {
  code: string;
  label: string;
  group: string;
}

export const REASON_GROUP_LEAD = 'Lead não compareceu';
export const REASON_GROUP_INVALIDO = 'Agendamento não deveria existir';
export const REASON_GROUP_OUTRO = 'Outro';

export const MEETING_OUTCOME_REASONS: OutcomeReason[] = [
  { code: 'nao_atendeu', label: 'Não atendeu / não entrou na sala', group: REASON_GROUP_LEAD },
  { code: 'avisou_em_cima', label: 'Avisou em cima da hora', group: REASON_GROUP_LEAD },
  { code: 'problema_tecnico', label: 'Problema técnico do lead', group: REASON_GROUP_LEAD },
  { code: 'pediu_remarcacao', label: 'Pediu para remarcar', group: REASON_GROUP_LEAD },

  { code: 'numero_invalido', label: 'Número inválido', group: REASON_GROUP_INVALIDO },
  { code: 'lead_duplicado', label: 'Lead duplicado', group: REASON_GROUP_INVALIDO },
  { code: 'fora_do_perfil', label: 'Fora do perfil', group: REASON_GROUP_INVALIDO },
  { code: 'agendamento_teste', label: 'Agendamento de teste', group: REASON_GROUP_INVALIDO },

  { code: 'outro', label: 'Outro', group: REASON_GROUP_OUTRO },
];

/** Motivo que exige observação livre obrigatória. */
export const REASON_REQUIRES_NOTE = 'outro';

export function requiresNote(code: string | null | undefined): boolean {
  return code === REASON_REQUIRES_NOTE;
}

/** Rótulo do motivo; devolve o próprio código se for desconhecido. */
export function getReasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return MEETING_OUTCOME_REASONS.find(r => r.code === code)?.label ?? code;
}

/** Lista agrupada, na ordem de declaração, para renderizar o seletor. */
export function getGroupedReasons(): { group: string; reasons: OutcomeReason[] }[] {
  const out: { group: string; reasons: OutcomeReason[] }[] = [];
  for (const r of MEETING_OUTCOME_REASONS) {
    let bucket = out.find(g => g.group === r.group);
    if (!bucket) {
      bucket = { group: r.group, reasons: [] };
      out.push(bucket);
    }
    bucket.reasons.push(r);
  }
  return out;
}

/** Rótulo usado para no-shows anteriores a esta mudança (sem motivo gravado). */
export const NO_REASON_LABEL = 'sem motivo registrado';
