const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StageRef { id: string; stage_name: string }
export interface StageChangeRow { to_stage?: string | null; metadata?: unknown }

/** Id da etapa destino: metadata.to_stage_id > to_stage UUID > nome resolvido em crm_stages. */
export function resolveToStageId(row: StageChangeRow, stages: StageRef[]): string | null {
  const meta = (row.metadata as Record<string, any> | null) || {};
  if (typeof meta.to_stage_id === 'string' && meta.to_stage_id) return meta.to_stage_id;
  const raw = (row.to_stage || '').trim();
  if (!raw) return null;
  if (UUID_RE.test(raw)) return raw;
  const lower = raw.toLowerCase();
  return stages.find(s => (s.stage_name || '').trim().toLowerCase() === lower)?.id ?? null;
}

export type StageMoveKind = 'perda' | 'terminal' | 'avanco' | null;

/** Classifica a movimentação: perda, terminal (ganho/fechado) ou avanço; null sem etapa destino. */
export function classifyStageMove(row: StageChangeRow, stages: StageRef[], lossIds: Set<string>, terminalIds: Set<string>): StageMoveKind {
  if (!row.to_stage && !((row.metadata as any)?.to_stage_id)) return null;
  const id = resolveToStageId(row, stages);
  // Etapa não encontrada mantém a regra anterior: conta como avanço.
  if (!id) return 'avanco';
  if (lossIds.has(id)) return 'perda';
  if (terminalIds.has(id)) return 'terminal';
  return 'avanco';
}
