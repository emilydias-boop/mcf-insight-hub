/** Máscara BRL: converte dígitos em "1.234,56" e volta para número. */
export function formatBRLInput(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return (Number(digits) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseBRLInput(formatted: string): number {
  const digits = String(formatted ?? '').replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function numberToBRLInput(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
