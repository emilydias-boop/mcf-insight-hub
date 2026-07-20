const yearSuffix = String(new Date().getFullYear()).slice(-2);

/**
 * Gera um identificador estável de 6 dígitos a partir do id do título:
 * 4 dígitos derivados do id + 2 dígitos do ano corrente.
 */
export function ticketNumber(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const four = String(hash % 10000).padStart(4, '0');
  return `${four}${yearSuffix}`;
}

/**
 * Documento da parcela: nº do título original + "-" + nº da parcela.
 * Ex.: título 761226 com 3 parcelas => 761226-1, 761226-2, 761226-3.
 */
export function parcelaDocNumber(tituloId: string, numeroParcela: number): string {
  return `${ticketNumber(tituloId)}-${numeroParcela}`;
}