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

/**
 * Problemas que impedem o envio — não são aviso. Definição ÚNICA: o wizard e o
 * "retomar" importam daqui, para não divergirem.
 */
export const PROBLEMAS_BLOQUEANTES = new Set(['variavel_sem_valor', 'template_nao_aprovado']);

export const PROBLEMA_LABEL: Record<string, string> = {
  variavel_sem_valor: 'Template não pode ser usado em disparo em massa',
  template_nao_aprovado: 'Template não aprovado pela Meta',
  nome_invalido: 'Nome cadastrado é o telefone',
  sem_alvos: 'Nenhum alvo elegível',
  publico_acima_do_saldo: 'Público maior que o saldo do dia',
};

export function problemaLabel(problema: string): string {
  return PROBLEMA_LABEL[problema] ?? problema.replace(/_/g, ' ');
}

/** Variáveis que o disparo em massa sabe preencher a partir do lead. */
export const VARIAVEIS_SUPORTADAS = new Set(['nome', '1', 'name', 'first_name']);

/** Variáveis do template que o disparo em massa não tem como preencher. */
export function variaveisNaoSuportadas(variables: string[] | null | undefined): string[] {
  return (variables ?? []).filter((v) => !VARIAVEIS_SUPORTADAS.has(String(v).toLowerCase()));
}

/** Por que este template não serve para disparo em massa (null = serve). */
export function motivoTemplateIndisponivel(
  variables: string[] | null | undefined,
): string | null {
  const faltando = variaveisNaoSuportadas(variables);
  if (faltando.length === 0) return null;
  return `Este template exige ${faltando.map((v) => `{{${v}}}`).join(', ')}, um dado individual por pessoa que o disparo em massa não tem como preencher. Use-o em conversa individual no inbox.`;
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