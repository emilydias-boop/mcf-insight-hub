/**
 * Catálogo único de resultados de ligação (outcome manual).
 *
 * Usado tanto no fluxo avulso (botão "Ligar" → PostCallModal) quanto no
 * Auto-Discador em motor Sonax, onde não existe detecção automática de
 * atendida/duração — o SDR registra o resultado à mão.
 */
export interface CallOutcomeOption {
  value: string;
  label: string;
  color: string;
  /** Considera-se que houve contato humano (alimenta "atendidas"/conexão %) */
  answered: boolean;
  /** Conversa com avanço real (alimenta "qualificadas") */
  qualified: boolean;
}

export const CALL_OUTCOMES: CallOutcomeOption[] = [
  { value: 'atendida', label: '🗣️ Atendida / falei com o lead', color: 'text-green-600', answered: true, qualified: false },
  { value: 'interessado', label: '✅ Interessado', color: 'text-green-500', answered: true, qualified: true },
  { value: 'agendou_r1', label: '📅 Agendou R1', color: 'text-blue-500', answered: true, qualified: true },
  { value: 'agendou_r2', label: '📅 Agendou R2', color: 'text-blue-500', answered: true, qualified: true },
  { value: 'follow_up', label: '🔄 Follow-up', color: 'text-orange-500', answered: true, qualified: true },
  { value: 'nao_interessado', label: '👎 Não interessado', color: 'text-red-500', answered: true, qualified: false },
  { value: 'sem_contato', label: '📵 Sem contato', color: 'text-gray-500', answered: false, qualified: false },
  { value: 'ocupado', label: '📞 Ocupado', color: 'text-yellow-500', answered: false, qualified: false },
  { value: 'caixa_postal', label: '📬 Caixa postal', color: 'text-gray-500', answered: false, qualified: false },
  { value: 'numero_errado', label: '❌ Número errado', color: 'text-red-500', answered: false, qualified: false },
  { value: 'outro', label: '📝 Outro', color: 'text-gray-500', answered: false, qualified: false },
];

/** Opções compactas mostradas no banner do Auto-Discador (Sonax) */
export const QUICK_OUTCOMES = ['atendida', 'sem_contato', 'caixa_postal', 'numero_errado'] as const;

export const outcomeMeta = (value?: string | null): CallOutcomeOption | undefined =>
  CALL_OUTCOMES.find((o) => o.value === value);

export const isAnsweredOutcome = (value?: string | null): boolean => !!outcomeMeta(value)?.answered;
export const isQualifiedOutcome = (value?: string | null): boolean => !!outcomeMeta(value)?.qualified;
