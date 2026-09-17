/** Formatações e derivações de selo da tela de Clientes (100% leitura). */

export const brl = (valor?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(valor ?? 0),
  );

export const inteiro = (valor?: number | null) =>
  new Intl.NumberFormat('pt-BR').format(Number(valor ?? 0));

export const dataCurta = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

/** 11 dígitos = CPF, 14 = CNPJ; qualquer outro tamanho volta como está. */
export const formatarDocumento = (valor?: string | null) => {
  const d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return valor ?? '';
};

/** Gateways que não recebem venda nova desde junho/2026 — só registro antigo. */
export const gatewayLegado = (gateway?: string | null) =>
  ['make', 'manual'].includes(String(gateway ?? '').trim().toLowerCase());

export type SeloTom = 'neutro' | 'atencao';
export interface Selo {
  texto: string;
  tom: SeloTom;
}

export function selosDoItem(item: {
  pagamentos?: number | null;
  parcelasContratadas?: number | null;
  bruto?: number | null;
  dias?: number | null;
  gateway?: string | null;
}): Selo[] {
  const selos: Selo[] = [];
  const pagos = Number(item.pagamentos ?? 0);
  const contratadas = Number(item.parcelasContratadas ?? 0);

  if (pagos > 1) {
    const total = contratadas > 1 ? contratadas : pagos;
    selos.push({ texto: `${pagos} de ${total} pagas`, tom: 'neutro' });
  }
  if (Number(item.bruto ?? 0) === 0) {
    selos.push({ texto: 'só cobrança', tom: 'neutro' });
  }
  if (Number(item.dias ?? 0) > 180) {
    selos.push({ texto: `verificar · ${inteiro(item.dias)} dias`, tom: 'atencao' });
  }
  if (gatewayLegado(item.gateway)) {
    selos.push({ texto: String(item.gateway), tom: 'atencao' });
  }
  return selos;
}

/** true quando dois itens têm o mesmo líquido arredondado ao centavo. */
export function temLiquidoDuplicado(liquidos: Array<number | null | undefined>): boolean {
  const vistos = new Set<string>();
  for (const l of liquidos) {
    if (l === null || l === undefined) continue;
    const chave = Number(l).toFixed(2);
    if (vistos.has(chave)) return true;
    vistos.add(chave);
  }
  return false;
}
