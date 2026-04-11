

# Remover Fila de Cobrança da tela de Cobranças

## O que será feito
Remover o componente `<CobrancaQueue>` da página de Cobranças (`FinanceiroCobrancas.tsx`), incluindo seu import e o handler `handleSelect` associado.

## Alterações

**Arquivo:** `src/components/financeiro/cobranca/FinanceiroCobrancas.tsx`
- Remover import de `CobrancaQueue` (linha 17)
- Remover a função `handleSelect` (linhas ~58-61)
- Remover `<CobrancaQueue onSelect={handleSelect} />` do JSX (linha ~115)

