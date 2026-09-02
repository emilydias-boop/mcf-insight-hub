const SUPABASE_URL = 'https://rehcfgqvigfcekiipqkc.supabase.co';

/**
 * A Sonax entrega a gravação em https://gravacoes.sonax.cloud/?a=d&v=...
 * com Content-Type application/octet-stream (o que quebra o <audio> em alguns
 * navegadores). Passamos pelo proxy próprio, que normaliza para audio/mpeg.
 */
export function sonaxRecordingProxy(url: string | null | undefined): string | null {
  if (!url) return null;
  // Marcadores internos (ex.: "sonax-api:<id_chamada>") não são URLs tocáveis;
  // quem trata isso é o SonaxApiRecording, via busca autenticada.
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'gravacoes.sonax.cloud') return url;
  } catch {
    return null;
  }
  return `${SUPABASE_URL}/functions/v1/get-sonax-recording?url=${encodeURIComponent(url)}`;
}

/** Duração da Sonax vem como segundos ou "HH:MM:SS". Retorna segundos. */
export function sonaxDurationSeconds(raw: string | null | undefined): number {
  if (!raw) return 0;
  if (raw.includes(':')) {
    const parts = raw.split(':').map((p) => Number(p) || 0);
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }
  const n = Number(String(raw).replace(/\D/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Datas da Sonax chegam como texto "YYYY-MM-DD HH:MM:SS" (horário local BRT). */
export function sonaxParseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
