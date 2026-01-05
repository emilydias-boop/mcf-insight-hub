import { TipoProduto } from '@/types/consorcio';

// Tabela de comissões SELECT
const COMISSAO_SELECT: Record<number, number> = {
  1: 1.20,   // Parcela 1: 1.2%
  2: 1.12,   // Parcela 2: 1.12%
  3: 1.12,   // Parcela 3: 1.12%
  4: 0.62,   // Parcela 4: 0.62%
  5: 0.11,   // Parcela 5: 0.11%
  6: 0.11,   // Parcela 6: 0.11%
  7: 0.11,   // Parcela 7: 0.11%
  8: 1.11,   // Parcela 8: 1.11%
};

// Função para obter percentual SELECT
function getPercentualSelect(numeroParcela: number): number {
  if (numeroParcela <= 8) {
    return COMISSAO_SELECT[numeroParcela] || 0;
  }
  // Após parcela 8, não há mais comissão definida
  return 0;
}

// Função para obter percentual PARCELINHA
function getPercentualParcelinha(numeroParcela: number): number {
  if (numeroParcela === 1) {
    return 0.53; // Parcela 1: 0.53%
  }
  if (numeroParcela >= 2 && numeroParcela <= 4) {
    return 0.43; // Parcelas 2, 3, 4: 0.43%
  }
  if (numeroParcela >= 5 && numeroParcela <= 12) {
    return 0.33; // Parcelas 5 até 12: 0.33%
  }
  // Após parcela 12, não há mais comissão
  return 0;
}

// Função principal para calcular comissão
export function calcularComissao(
  valorCredito: number,
  tipoProduto: TipoProduto,
  numeroParcela: number
): number {
  let percentual: number;
  
  if (tipoProduto === 'select') {
    percentual = getPercentualSelect(numeroParcela);
  } else {
    percentual = getPercentualParcelinha(numeroParcela);
  }
  
  return (valorCredito * percentual) / 100;
}

// Calcula comissão total prevista para uma carta
export function calcularComissaoTotal(
  valorCredito: number,
  tipoProduto: TipoProduto
): number {
  let total = 0;
  const maxParcelas = tipoProduto === 'select' ? 8 : 12;
  
  for (let i = 1; i <= maxParcelas; i++) {
    total += calcularComissao(valorCredito, tipoProduto, i);
  }
  
  return total;
}

// Retorna o percentual formatado
export function getPercentualFormatado(
  tipoProduto: TipoProduto,
  numeroParcela: number
): string {
  let percentual: number;
  
  if (tipoProduto === 'select') {
    percentual = getPercentualSelect(numeroParcela);
  } else {
    percentual = getPercentualParcelinha(numeroParcela);
  }
  
  return `${percentual.toFixed(2)}%`;
}

// Retorna todas as parcelas com comissão para um tipo de produto
export function getParcelasComComissao(tipoProduto: TipoProduto): number[] {
  if (tipoProduto === 'select') {
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

// Calcula resumo de comissões
export function calcularResumoComissoes(
  valorCredito: number,
  tipoProduto: TipoProduto,
  parcelasPagas: number[]
): {
  total: number;
  recebida: number;
  pendente: number;
} {
  const total = calcularComissaoTotal(valorCredito, tipoProduto);
  
  let recebida = 0;
  for (const parcela of parcelasPagas) {
    recebida += calcularComissao(valorCredito, tipoProduto, parcela);
  }
  
  return {
    total,
    recebida,
    pendente: total - recebida,
  };
}
