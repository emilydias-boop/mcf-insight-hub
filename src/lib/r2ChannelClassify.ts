/**
 * Classificação de canal SIMPLIFICADA (A010 / ANAMNESE / Outro)
 * usada no Calendário R1, listas R2 e Carrinho R2.
 *
 * Regras (alinhadas com mem://business-logic/agenda-r1-channel-classification):
 * - A010: comprou A010 (hubla_transactions product_category='a010' completed)
 *   por email ou últimos 9 dígitos do telefone.
 * - ANAMNESE: tem tag exatamente "ANAMNESE" (uppercase, trim).
 * - Outro: qualquer outra coisa.
 *
 * Window de 30 dias: se a venda A010 mais recente é > 30 dias antes da
 * referenceDate (scheduled_at do evento), trata como "esfriado":
 *   - se também tem tag ANAMNESE → reclassifica como ANAMNESE
 *   - senão → continua A010
 */

export type SimpleChannel = 'A010' | 'ANAMNESE' | 'Outro';

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizePhone9(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

/** Converte tags brutas (jsonb array de strings ou objetos) em string[]. */
export function parseTagsRaw(rawTags: any): string[] {
  if (!Array.isArray(rawTags)) return [];
  return rawTags
    .map((t: any) => {
      if (typeof t === 'string') {
        if (t.startsWith('{')) {
          try { const p = JSON.parse(t); return p?.name || t; } catch { return t; }
        }
        return t;
      }
      return (t as any)?.name || '';
    })
    .filter(Boolean);
}

export function classifySimpleChannel(opts: {
  /** ms entre referenceDate e a venda A010 mais recente; null = não é buyer */
  a010AgeMs: number | null;
  tags: string[];
}): SimpleChannel {
  const { a010AgeMs, tags } = opts;
  const isBuyer = a010AgeMs !== null;
  const isStale = a010AgeMs !== null && a010AgeMs > THIRTY_DAYS_MS;
  const norm = (tags || []).map(t => (t || '').trim().toUpperCase());
  const hasAnamnese = norm.some(t => t === 'ANAMNESE');

  if (isBuyer && !isStale) return 'A010';
  if (isBuyer && isStale && hasAnamnese) return 'ANAMNESE';
  if (isBuyer && isStale) return 'A010';
  if (hasAnamnese) return 'ANAMNESE';
  return 'Outro';
}

export interface A010Sets {
  emailMap: Map<string, string>; // email -> ISO sale_date mais recente
  phoneMap: Map<string, string>; // phone9 -> ISO sale_date mais recente
}

/** Calcula idade (ms) entre referenceISO e a venda A010 mais recente do lead. */
export function computeA010Age(
  sets: A010Sets | null | undefined,
  email: string | null | undefined,
  phone: string | null | undefined,
  referenceISO: string | null | undefined,
): number | null {
  if (!sets) return null;
  const e = (email || '').toLowerCase().trim();
  const p9 = normalizePhone9(phone);
  const dates: string[] = [];
  if (e && sets.emailMap.has(e)) dates.push(sets.emailMap.get(e)!);
  if (p9 && sets.phoneMap.has(p9)) dates.push(sets.phoneMap.get(p9)!);
  const valid = dates.filter(Boolean).map(d => new Date(d).getTime()).filter(n => !isNaN(n));
  if (valid.length === 0) {
    if ((e && sets.emailMap.has(e)) || (p9 && sets.phoneMap.has(p9))) return 0;
    return null;
  }
  const mostRecent = Math.max(...valid);
  const refMs = referenceISO ? new Date(referenceISO).getTime() : NaN;
  const baseMs = isNaN(refMs) ? Date.now() : refMs;
  return baseMs - mostRecent;
}

/** Helper completo para classificar diretamente. */
export function classifyR2Lead(opts: {
  sets: A010Sets | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
  referenceISO: string | null | undefined;
  tags: string[];
}): SimpleChannel {
  return classifySimpleChannel({
    a010AgeMs: computeA010Age(opts.sets, opts.email, opts.phone, opts.referenceISO),
    tags: opts.tags,
  });
}