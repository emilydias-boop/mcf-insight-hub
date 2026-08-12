/**
 * Janela legal/operacional de reembolso:
 * - Cartão de crédito: 180 dias a partir da data da venda
 * - PIX: 90 dias a partir da data da venda
 * - Outros meios: usa 90 dias como referência conservadora
 */
export type RefundMethodKind = 'cartao' | 'pix' | 'outro';

export interface RefundWindowInfo {
  kind: RefundMethodKind;
  methodLabel: string;
  limitDays: number;
  /** Data limite (YYYY-MM-DD) ou null se não há data de venda */
  deadline: Date | null;
  /** Dias restantes até o limite (negativo = expirado) */
  daysLeft: number | null;
  /** true = ainda pode reembolsar; false = prazo expirado; null = indeterminado */
  allowed: boolean | null;
}

export function classifyPaymentMethod(pm?: string | null): RefundMethodKind {
  const s = (pm || '').toLowerCase();
  if (!s) return 'outro';
  if (s.includes('pix')) return 'pix';
  if (
    s.includes('credit') ||
    s.includes('cartao') ||
    s.includes('cartão') ||
    s.includes('card')
  )
    return 'cartao';
  return 'outro';
}

const METHOD_LABEL: Record<RefundMethodKind, string> = {
  cartao: 'Cartão de crédito',
  pix: 'PIX',
  outro: 'Outro meio',
};

const parseDay = (v: string | Date): Date => {
  if (v instanceof Date) return v;
  const s = String(v).slice(0, 10);
  return new Date(s + 'T00:00:00');
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function getRefundWindow(
  saleDate: string | Date | null | undefined,
  paymentMethod: string | null | undefined,
  referenceDate?: string | Date | null,
): RefundWindowInfo {
  const kind = classifyPaymentMethod(paymentMethod);
  const limitDays = kind === 'cartao' ? 180 : 90;
  const base: RefundWindowInfo = {
    kind,
    methodLabel: METHOD_LABEL[kind],
    limitDays,
    deadline: null,
    daysLeft: null,
    allowed: null,
  };
  if (!saleDate) return base;

  const sale = startOfDay(parseDay(saleDate));
  if (Number.isNaN(sale.getTime())) return base;

  const deadline = new Date(sale);
  deadline.setDate(deadline.getDate() + limitDays);

  const ref = startOfDay(referenceDate ? parseDay(referenceDate) : new Date());
  const daysLeft = Math.round((deadline.getTime() - ref.getTime()) / 86400000);

  return { ...base, deadline, daysLeft, allowed: daysLeft >= 0 };
}
