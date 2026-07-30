/**
 * Offers that identify a legitimate "Outside" lead.
 * A lead is Outside ONLY if their contract has one of these offer_names.
 * NOTE: fallback estático — a fonte de verdade é a tabela public.outside_offers.
 */
export const OUTSIDE_OFFER_NAMES = [
  'Contrato - Curso R$ 97,00',
  'Contrato Perfil A - Vitrine A010',
  'A000 - Contrato MCF - Construir pra Alugar',
  'Contrato - Lançamento 29/07',
] as const;

export const OUTSIDE_OFFER_IDS = [
  'nPPUxJUzDl5mfa31XpIU',
] as const;

/**
 * Check if an offer_name qualifies as an Outside offer.
 */
export function isOutsideOffer(offerName: string | null | undefined): boolean {
  if (!offerName) return false;
  return OUTSIDE_OFFER_NAMES.some(name => 
    offerName.toLowerCase().trim() === name.toLowerCase()
  );
}

export interface OutsideOfferRow {
  offer_name: string | null;
  offer_id: string | null;
}

/**
 * Builds a matcher from the configurable outside_offers table,
 * falling back to the static lists above when unavailable.
 */
export function buildOutsideOfferMatcher(rows: OutsideOfferRow[] | null | undefined) {
  const names = new Set<string>();
  const ids = new Set<string>();

  if (rows?.length) {
    for (const row of rows) {
      if (row.offer_name) names.add(row.offer_name.toLowerCase().trim());
      if (row.offer_id) ids.add(row.offer_id.trim());
    }
  } else {
    OUTSIDE_OFFER_NAMES.forEach(n => names.add(n.toLowerCase()));
    OUTSIDE_OFFER_IDS.forEach(i => ids.add(i));
  }

  return (offerName: string | null | undefined, offerId?: string | null): boolean => {
    if (offerName && names.has(offerName.toLowerCase().trim())) return true;
    if (offerId && ids.has(offerId.trim())) return true;
    return false;
  };
}
