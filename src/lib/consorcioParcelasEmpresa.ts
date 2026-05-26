import type { TipoContrato } from '@/types/consorcio';

export interface ParcelaEmpresa {
  numero: number;
  valor: number;
}

export interface GetParcelasEmpresaInput {
  prazo_meses: number | null | undefined;
  parcelas_pagas_empresa: number | null | undefined;
  tipo_contrato: TipoContrato | string | null | undefined;
  valor_credito: number | null | undefined;
  empresa_paga_parcelas?: string | null;
}

/**
 * Calcula quais parcelas a empresa pagará e o valor de cada uma.
 * Espelha exatamente a lógica usada em useOpenCota (intercalado par/ímpar/normal).
 */
export function getParcelasEmpresa(input: GetParcelasEmpresaInput): ParcelaEmpresa[] {
  const prazo = Number(input.prazo_meses || 0);
  const qtd = Number(input.parcelas_pagas_empresa || 0);
  const valorCredito = Number(input.valor_credito || 0);
  if (!prazo || !qtd || !valorCredito) return [];
  if (input.empresa_paga_parcelas === 'nao') return [];

  const tipo = input.tipo_contrato || 'normal';
  const valorParcela = valorCredito / prazo;
  const out: ParcelaEmpresa[] = [];

  for (let i = 1; i <= prazo; i++) {
    let isEmpresa = false;
    if (tipo === 'intercalado') {
      const ehPar = i % 2 === 0;
      isEmpresa = ehPar && i / 2 <= qtd;
    } else if (tipo === 'intercalado_impar') {
      const ehImpar = i % 2 === 1;
      isEmpresa = ehImpar && Math.ceil(i / 2) <= qtd;
    } else {
      isEmpresa = i <= qtd;
    }
    if (isEmpresa) out.push({ numero: i, valor: valorParcela });
  }
  return out;
}

export function tipoContratoLabel(tipo?: string | null): string {
  switch (tipo) {
    case 'intercalado':
      return 'Intercalado par';
    case 'intercalado_impar':
      return 'Intercalado ímpar';
    case 'normal':
    default:
      return 'Normal';
  }
}