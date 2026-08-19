/**
 * Regras de mídia do WhatsApp (Twilio) usadas no MCF Atendimento.
 * O bucket `wa-media` tem limite de 16MB e o path é sempre
 * `<conversation_id>/<arquivo>` — a policy do bucket autoriza por esse prefixo.
 */
export const WA_MEDIA_MAX_BYTES = 16 * 1024 * 1024;

export const WA_MEDIA_ACCEPTED_TYPES = [
  // imagem
  'image/jpeg',
  'image/png',
  'image/webp',
  // áudio
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/amr',
  // vídeo
  'video/mp4',
  'video/3gpp',
  // documento
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
] as const;

/** Extensões que aceitamos no seletor de arquivo (espelha a lista de MIME). */
export const WA_MEDIA_ACCEPT_ATTR =
  '.jpg,.jpeg,.png,.webp,.ogg,.oga,.mp3,.m4a,.amr,.mp4,.3gp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,' +
  WA_MEDIA_ACCEPTED_TYPES.join(',');

export type WaMediaKind = 'image' | 'audio' | 'video' | 'document';

/** Normaliza o MIME do navegador (que às vezes vem com `;codecs=...`). */
export function normalizeMediaType(type: string | undefined | null): string {
  return (type ?? '').split(';')[0].trim().toLowerCase();
}

const EXT_TO_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  amr: 'audio/amr',
  mp4: 'video/mp4',
  '3gp': 'video/3gpp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
};

/** Resolve o MIME do arquivo, caindo para a extensão quando o browser não informa. */
export function resolveMediaType(file: File): string {
  const fromFile = normalizeMediaType(file.type);
  if (fromFile && WA_MEDIA_ACCEPTED_TYPES.includes(fromFile as never)) return fromFile;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_TYPE[ext] ?? fromFile;
}

export function mediaKindFromType(type: string): WaMediaKind {
  const t = normalizeMediaType(type);
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('video/')) return 'video';
  return 'document';
}

/** Mensagem de erro em pt-BR, ou null quando o arquivo é válido. */
export function validateWaMedia(file: File): string | null {
  if (file.size === 0) return 'O arquivo está vazio.';
  if (file.size > WA_MEDIA_MAX_BYTES) {
    return `Arquivo muito grande (${formatBytes(file.size)}). O limite do WhatsApp é 16MB.`;
  }
  const type = resolveMediaType(file);
  if (!WA_MEDIA_ACCEPTED_TYPES.includes(type as never)) {
    return `Tipo de arquivo não aceito pelo WhatsApp${type ? ` (${type})` : ''}. Envie imagem (jpeg, png, webp), áudio (ogg, mp3, m4a, amr), vídeo (mp4, 3gp) ou documento (pdf, doc, xls, csv, txt).`;
  }
  return null;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Nome de arquivo seguro para path de storage. */
export function safeFileName(name: string): string {
  return (name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80);
}

/**
 * Rótulos que o backend grava em `body` quando a mídia vem sem legenda.
 * Servem para o preview da lista de conversas e não devem aparecer como legenda.
 */
const MEDIA_PLACEHOLDERS = new Set([
  '[imagem]',
  '[audio]',
  '[áudio]',
  '[video]',
  '[vídeo]',
  '[documento]',
  '[arquivo]',
  '[midia]',
  '[mídia]',
]);

export function isMediaPlaceholder(body: string | null | undefined): boolean {
  if (!body) return true;
  return MEDIA_PLACEHOLDERS.has(body.trim().toLowerCase());
}