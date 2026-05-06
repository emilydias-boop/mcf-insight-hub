import { TipoProduto } from '@/types/consorcio';
import { ComissaoScheduleItem, ComissaoBase, ConsorcioProduto } from '@/types/consorcioProdutos';

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

// Contexto opcional do produto: se fornecido, usa o cronograma customizado
// e a base de cálculo definida no cadastro de produto.
export interface ProdutoComissaoContext {
  schedule?: ComissaoScheduleItem[] | null;
  base?: ComissaoBase;
  valorParcela?: number;
  valorVenda?: number;
}

function getPercentualFromContext(
  ctx: ProdutoComissaoContext | undefined,
  tipoProduto: TipoProduto,
  numeroParcela: number
): { percentual: number; usouCustom: boolean } {
  if (ctx?.schedule && ctx.schedule.length > 0) {
    const item = ctx.schedule.find((s) => s.parcela === numeroParcela);
    return { percentual: item?.percentual ?? 0, usouCustom: true };
  }
  // Fallback hardcoded
  if (tipoProduto === 'select') return { percentual: getPercentualSelect(numeroParcela), usouCustom: false };
  return { percentual: getPercentualParcelinha(numeroParcela), usouCustom: false };
}

function getBaseValor(
  valorCredito: number,
  ctx: ProdutoComissaoContext | undefined
): number {
  const base = ctx?.base ?? 'valor_credito';
  if (base === 'valor_parcela') return ctx?.valorParcela ?? valorCredito;
  if (base === 'valor_venda') return ctx?.valorVenda ?? valorCredito;
  return valorCredito;
}

// Função principal para calcular comissão
export function calcularComissao(
  valorCredito: number,
  tipoProduto: TipoProduto,
  numeroParcela: number,
  ctx?: ProdutoComissaoContext
): number {
  const { percentual } = getPercentualFromContext(ctx, tipoProduto, numeroParcela);
  const base = getBaseValor(valorCredito, ctx);
  return (base * percentual) / 100;
}

// Helper para construir contexto a partir de um produto cadastrado
export function comissaoContextFromProduto(
  produto?: Pick<ConsorcioProduto, 'comissao_schedule' | 'comissao_base'> | null
): ProdutoComissaoContext | undefined {
  if (!produto) return undefined;
  return {
    schedule: produto.comissao_schedule ?? null,
    base: produto.comissao_base ?? 'valor_credito',
  };
}

// Calcula comissão total prevista para uma carta
export function calcularComissaoTotal(
  valorCredito: number,
  tipoProduto: TipoProduto,
  ctx?: ProdutoComissaoContext
): number {
  let total = 0;
  if (ctx?.schedule && ctx.schedule.length > 0) {
    for (const item of ctx.schedule) {
      total += calcularComissao(valorCredito, tipoProduto, item.parcela, ctx);
    }
    return total;
  }
  const maxParcelas = tipoProduto === 'select' ? 8 : 12;
  for (let i = 1; i <= maxParcelas; i++) {
    total += calcularComissao(valorCredito, tipoProduto, i, ctx);
  }
  return total;
}

// Retorna o percentual formatado
export function getPercentualFormatado(
  tipoProduto: TipoProduto,
  numeroParcela: number,
  ctx?: ProdutoComissaoContext
): string {
  const { percentual } = getPercentualFromContext(ctx, tipoProduto, numeroParcela);
  return `${percentual.toFixed(2)}%`;
}

// Retorna todas as parcelas com comissão para um tipo de produto
export function getParcelasComComissao(
  tipoProduto: TipoProduto,
  ctx?: ProdutoComissaoContext
): number[] {
  if (ctx?.schedule && ctx.schedule.length > 0) {
    return ctx.schedule.map((s) => s.parcela).sort((a, b) => a - b);
  }
  if (tipoProduto === 'select') return [1, 2, 3, 4, 5, 6, 7, 8];
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

// Calcula resumo de comissões
export function calcularResumoComissoes(
  valorCredito: number,
  tipoProduto: TipoProduto,
  parcelasPagas: number[],
  ctx?: ProdutoComissaoContext
): {
  total: number;
  recebida: number;
  pendente: number;
} {
  const total = calcularComissaoTotal(valorCredito, tipoProduto, ctx);
  let recebida = 0;
  for (const parcela of parcelasPagas) {
    recebida += calcularComissao(valorCredito, tipoProduto, parcela, ctx);
  }
  return { total, recebida, pendente: total - recebida };
}
