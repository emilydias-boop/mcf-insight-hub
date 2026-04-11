/**
 * Offers that identify a legitimate "Outside" lead.
 * A lead is Outside ONLY if their contract has one of these offer_names.
 */
export const OUTSIDE_OFFER_NAMES = [
  'Contrato - Curso R$ 97,00',
  'Contrato Perfil A - Vitrine A010',
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
