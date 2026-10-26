import { strict as assert } from 'node:assert';
import { classifyStageMove, resolveToStageId } from './crmStageClassification';

const PERDIDO = '11111111-1111-1111-1111-111111111111';
const GANHO = '22222222-2222-2222-2222-222222222222';
const CONTATO = '33333333-3333-3333-3333-333333333333';
const stages = [
  { id: PERDIDO, stage_name: 'Perdido' },
  { id: GANHO, stage_name: 'Contrato Pago' },
  { id: CONTATO, stage_name: 'Em contato' },
];
const loss = new Set([PERDIDO]);
const terminal = new Set([PERDIDO, GANHO]);
const k = (row: any) => classifyStageMove(row, stages, loss, terminal);

// Linha com nome (gatilho)
assert.equal(k({ to_stage: 'Perdido' }), 'perda');
assert.equal(k({ to_stage: 'Contrato Pago' }), 'terminal');
assert.equal(k({ to_stage: 'Em contato' }), 'avanco');
// Linha com UUID
assert.equal(k({ to_stage: PERDIDO }), 'perda');
assert.equal(k({ to_stage: GANHO }), 'terminal');
assert.equal(k({ to_stage: CONTATO }), 'avanco');
// metadata.to_stage_id tem prioridade sobre o nome
assert.equal(k({ to_stage: 'Em contato', metadata: { to_stage_id: PERDIDO } }), 'perda');
assert.equal(resolveToStageId({ to_stage: 'Qualquer', metadata: { to_stage_id: GANHO } }, stages), GANHO);
// Sem etapa destino
assert.equal(k({ to_stage: null }), null);

console.log('crmStageClassification: ok');
