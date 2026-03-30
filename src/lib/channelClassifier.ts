/**
 * Shared channel classification logic used across funnel, analysis, and sales reports.
 * Single source of truth for channel detection from deal metadata.
 */

export const VALID_CHANNELS = new Set(['A010', 'LIVE', 'ANAMNESE', 'ANAMNESE-INSTA', 'OUTSIDE', 'LANÇAMENTO']);

export function normalizeChannel(raw: string): string {
  if (VALID_CHANNELS.has(raw)) return raw;
  const upper = raw.toUpperCase();
  if (upper.includes('ANAMNESE-INSTA') || upper.includes('ANAMNESE INSTA')) return 'ANAMNESE-INSTA';
  if (upper.includes('ANAMNESE')) return 'ANAMNESE';
  if (upper.includes('A010')) return 'A010';
  if (upper.includes('LANÇAMENTO') || upper.includes('LANCAMENTO')) return 'LANÇAMENTO';
  if (upper.includes('OUTSIDE')) return 'OUTSIDE';
  return 'LIVE';
}

export function classifyChannel(opts: {
  tags: string[];
  originName: string | null;
  leadChannel: string | null;
  dataSource: string | null;
  hasA010: boolean;
}): string {
  const { tags, originName, leadChannel, dataSource, hasA010 } = opts;
  const allTags = tags.map(t => {
    if (typeof t === 'string') {
      if (t.startsWith('{')) {
        try { const p = JSON.parse(t); return (p?.name || t).toUpperCase(); } catch { return t.toUpperCase(); }
      }
      return t.toUpperCase();
    }
    return (t as any)?.name?.toUpperCase() || '';
  });

  const originUpper = (originName || '').toUpperCase();
  const channelUpper = (leadChannel || '').toUpperCase();

  // 1. Tags are primary source
  if (allTags.some(t => t.includes('ANAMNESE-INSTA') || t.includes('ANAMNESE INSTA'))) return 'ANAMNESE-INSTA';
  if (allTags.some(t => t.includes('ANAMNESE'))) return 'ANAMNESE';
  if (allTags.some(t => t.includes('BIO-INSTAGRAM') || t.includes('BIO INSTAGRAM'))) return 'BIO-INSTAGRAM';
  if (allTags.some(t => t.includes('LEAD-LIVE') || t.includes('LIVE'))) return 'LIVE';
  if (allTags.some(t => t.includes('LEAD-FORM') || t.includes('LEAD FORM'))) return 'LEAD-FORM';
  if (allTags.some(t => t.includes('A010') && t.includes('MAKE'))) return 'A010 (MAKE)';
  if (allTags.some(t => t === 'A010' || t.startsWith('A010 '))) return 'A010';
  if (allTags.some(t => t.includes('HUBLA'))) return 'HUBLA';
  if (allTags.some(t => t.includes('BASE CLINT'))) return 'BASE CLINT';

  // 2. Origin name as secondary source
  if (originUpper.includes('ANAMNESE-INSTA') || originUpper.includes('ANAMNESE INSTA')) return 'ANAMNESE-INSTA';
  if (originUpper.includes('ANAMNESE')) return 'ANAMNESE';
  if (originUpper.includes('BIO-INSTAGRAM') || originUpper.includes('BIO INSTAGRAM')) return 'BIO-INSTAGRAM';

  // 3. lead_channel as tertiary source
  if (channelUpper.includes('ANAMNESE-INSTA')) return 'ANAMNESE-INSTA';
  if (channelUpper.includes('ANAMNESE')) return 'ANAMNESE';
  if (channelUpper.includes('LIVE')) return 'LIVE';
  if (channelUpper.includes('LEAD-FORM')) return 'LEAD-FORM';

  // 4. Fallback
  if (dataSource === 'csv') return 'CSV';
  if (hasA010) return 'A010';
  if (dataSource === 'webhook') return 'WEBHOOK';
  return '';
}

export function getBestRawTag(tags: string[]): string | null {
  const NOISE = new Set(['CSV', 'REPLICATION', 'BASE CLINT', 'CLIENTDATA-INSIDE', 'CLIENTDATA', 'WEBHOOK']);
  for (const raw of tags) {
    const t = typeof raw === 'string' ? raw.trim() : '';
    if (!t) continue;
    const upper = t.toUpperCase();
    if (NOISE.has(upper)) continue;
    return upper;
  }
  return null;
}
