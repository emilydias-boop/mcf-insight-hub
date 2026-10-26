export const MEETING_STATUS: Record<string, string> = {
  scheduled: 'agendada', invited: 'agendada', completed: 'realizada',
  no_show: 'no-show', rescheduled: 'reagendada', cancelled: 'cancelada',
  canceled: 'cancelada', contract_paid: 'contrato pago', pre_scheduled: 'pré-agendada',
};

export function metadataAuthor(meta: Record<string, any>, type?: string): string | null {
  const actor = meta.moved_by_name || meta.moved_by_email || meta.deal_user_name || meta.deal_user;
  if (type === 'stage_change' || type === 'stage_changed') return actor || null;
  return actor || meta.sdr_name || meta.sdr_email || meta.author || meta.user_name || meta.created_by || null;
}

export function activityIsAutomatic(type: string, userId: string | null | undefined, meta: Record<string, any>): boolean {
  if (type === 'contato_registrado') return false;
  const system = ['auto_move', 'owner_auto_rule', 'tags_added', 'replication', 'creation', 'deal_created',
    'lead_distributed', 'lead_distribution', 'webhook_reentry', 'partner_detected', 'outside_detected', 'pos_venda_anamnese'];
  return system.includes(type) || type.startsWith('refund_') || (type === 'tags_changed' && !userId)
    || (!userId && !metadataAuthor(meta, type));
}

export function hasCorrespondingHangup(activity: { deal_id: string; created_at: string; metadata?: any },
  hangups: { deal_id: string; created_at: string; metadata?: any }[]): boolean {
  return hangups.some(h => {
    if (h.deal_id !== activity.deal_id) return false;
    const id = activity.metadata?.ID_CHAMADA;
    const hangupId = h.metadata?.ID_CHAMADA;
    if (id && hangupId) return String(id) === String(hangupId);
    return Math.abs(new Date(h.created_at).getTime() - new Date(activity.created_at).getTime()) <= 120_000;
  });
}

export function otherActivityPresentation(type: string, meta: Record<string, any>): { type: 'stage_change' | 'entry' | 'owner_change' | 'task' | 'automation' | 'call' | 'meeting' | 'purchase' | 'refund'; title: string } {
  const labels: Record<string, { type: 'stage_change' | 'entry' | 'owner_change' | 'task' | 'automation' | 'call' | 'meeting' | 'purchase' | 'refund'; title: string }> = {
    loss_marked: { type: 'stage_change', title: 'Marcado como perdido' },
    creation: { type: 'entry', title: 'Entrada' }, deal_created: { type: 'entry', title: 'Entrada' },
    replication: { type: 'entry', title: `Replicado para ${meta.target_pipeline_name || meta.to_pipeline_name || meta.pipeline_name || meta.target_pipeline || 'outra pipeline'}` },
    owner_auto_rule: { type: 'owner_change', title: 'Responsável definido automaticamente' },
    next_action_scheduled: { type: 'task', title: 'Próxima ação agendada' },
    next_action_completed: { type: 'task', title: 'Próxima ação concluída' },
    bu_transfer: { type: 'stage_change', title: 'Transferido entre BUs' },
    attendee_transferred: { type: 'meeting', title: 'Participante transferido' },
    merge: { type: 'entry', title: 'Negócios unificados' },
    recompra_a010_reativada: { type: 'entry', title: 'Lead reativado por recompra A010' },
    call_result: { type: 'call', title: 'Resultado da ligação registrado' },
  };
  if (labels[type]) return labels[type];
  if (type.startsWith('venda_direta_')) return { type: type.includes('estornada') ? 'refund' : 'purchase', title: `Venda direta · ${humanize(type.slice(13))}` };
  if (type.startsWith('pos_venda_')) return { type: 'automation', title: `Pós-venda · ${humanize(type.slice(10))}` };
  return { type: 'automation', title: humanize(type) };
}

function humanize(value: string): string {
  const words: Record<string, string> = { entrada: 'Entrada', compra: 'Compra', compras: 'Compras', registrado: 'registrado',
    registrada: 'registrada', cliente: 'cliente', contato: 'contato', nota: 'Nota', anamnese: 'Anamnese',
    vinculada: 'vinculada', vinculado: 'vinculado', approved: 'aprovada', completed: 'concluída',
    scheduled: 'agendada', cancelled: 'cancelada', transferred: 'transferido', created: 'criado',
    updated: 'atualizado', failed: 'falhou', success: 'concluída', reentry: 'reentrada',
    owner: 'Responsável', change: 'alterado', detected: 'detectado', paid: 'paga', reativada: 'reativada' };
  const label = value.split('_').map(w => words[w] || w).join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
export type ContatoIcone = 'phone' | 'message' | 'alert';
const CONTATO_ICONE: Record<string, ContatoIcone> = {
  atendeu: 'phone', nao_atendeu: 'phone', caixa_postal: 'phone',
  primeira_mensagem: 'message', respondeu_whatsapp: 'message', numero_errado: 'alert',
};
const CONTATO_ROTULO: Record<string, string> = {
  atendeu: 'Atendeu', nao_atendeu: 'Não atendeu', caixa_postal: 'Caixa postal',
  primeira_mensagem: 'Primeira mensagem enviada', respondeu_whatsapp: 'Respondeu no WhatsApp', numero_errado: 'Número errado',
};

/** Evento humano `contato_registrado`. Sem resultado → null (o next_action_scheduled já representa o registro). */
export function contatoRegistradoPresentation(meta: Record<string, any>): { title: string; body: string | null; icon: ContatoIcone } | null {
  const r = meta.resultado;
  if (!r) return null;
  return { title: meta.resultado_rotulo || CONTATO_ROTULO[r] || 'Contato registrado', body: meta.nota || null, icon: CONTATO_ICONE[r] || 'phone' };
}
