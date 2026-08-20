import type { WaBroadcastStatus, WaTargetStatus } from '@/hooks/wa/useWaBroadcasts';

export const BROADCAST_STATUS_LABEL: Record<WaBroadcastStatus, string> = {
  rascunho: 'Rascunho',
  aguardando: 'Aguardando',
  enviando: 'Enviando',
  pausado: 'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const TARGET_STATUS_LABEL: Record<WaTargetStatus, string> = {
  pendente: 'Pendente',
  enviando: 'Enviando',
  enviado: 'Enviado',
  falha: 'Falha',
  ignorado: 'Ignorado',
};

export const MOTIVO_IGNORADO_LABEL: Record<string, string> = {
  optout: 'Pediram para não receber',
  cooldown: 'Receberam disparo nos últimos 7 dias',
  nome_invalido: 'Nome cadastrado é o telefone',
  limite_marketing_do_destinatario: 'Limite de marketing do WhatsApp',
};

export function motivoLabel(motivo: string): string {
  return MOTIVO_IGNORADO_LABEL[motivo] ?? motivo.replace(/_/g, ' ');
}

/** Problemas que impedem o envio — não são aviso. */
export const PROBLEMAS_BLOQUEANTES = new Set(['variavel_sem_valor', 'template_nao_aprovado']);

export const PROBLEMA_LABEL: Record<string, string> = {
  variavel_sem_valor: 'Variável do template sem valor',
  template_nao_aprovado: 'Template não aprovado pela Meta',
  nome_invalido: 'Nome cadastrado é o telefone',
  sem_alvos: 'Nenhum alvo elegível',
  publico_acima_do_saldo: 'Público maior que o saldo do dia',
};

export function problemaLabel(problema: string): string {
  return PROBLEMA_LABEL[problema] ?? problema.replace(/_/g, ' ');
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Interpola a prévia do template com um nome real do público — o operador
 * precisa ver como a mensagem chega, não `{{nome}}` cru.
 */
export function interpolarPreview(
  preview: string | null,
  sampleName: string | null,
  extras: Record<string, string> = {},
): string {
  if (!preview) return '';
  const nome = sampleName ? firstName(sampleName) : 'Nome do lead';
  return preview.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_m, key: string) => {
    const k = String(key).toLowerCase();
    if (extras[k]) return extras[k];
    if (k === 'nome' || k === '1' || k === 'name' || k === 'first_name') return nome;
    return `[${key}]`;
  });
}

export function formatMinutos(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return '—';
  if (minutos < 60) return `${Math.ceil(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}