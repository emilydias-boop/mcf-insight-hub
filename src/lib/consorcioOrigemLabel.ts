import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Monta o rótulo de origem usado na aba Cadastros Pendentes.
 * Ex.: "Parceiro Y · Nov/2025"
 */
export function formatOrigemLabel(
  originName?: string | null,
  aceiteDate?: string | null,
  manualOrigem?: string | null,
): string {
  const origem =
    (originName || '').trim() ||
    (manualOrigem || '').trim() ||
    'Sem origem';
  if (!aceiteDate) return origem;
  try {
    // aceite_date é DATE (YYYY-MM-DD) — evita timezone shift
    const [y, m, d] = aceiteDate.split('-').map(Number);
    if (!y || !m) return origem;
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const mes = format(dt, 'MMM/yyyy', { locale: ptBR });
    const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
    return `${origem} · ${mesCap}`;
  } catch {
    return origem;
  }
}