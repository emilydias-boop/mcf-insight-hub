

# Plano: Separar categorias no "Faturamento por Closer"

## Problema Atual

A linha "Sem closer" (1.547 transacoes) mistura categorias completamente diferentes:

| Categoria | Transacoes | Natureza |
|-----------|-----------|----------|
| A010 (Consultoria) | ~2.238 | Funil de entrada automatico (R$ 47), nao depende de closer |
| ACESSO VITALICIO | ~616 | Order bump automatico (R$ 57), nao depende de closer |
| A000 - Contrato | ~449 | Contrato de adesao (R$ 497), pre-venda |
| A005 - MCF P2 | ~44 | Parte 2 da parceria, deveria estar no closer |
| A009/A001 parceria | ~16 | Vendas via Make/Asaas, deveriam estar no closer |
| Parceria generica | ~112 | Vendas Make, deveriam estar no closer |

## Solucao em 2 Frentes

### Frente 1: Separar A010 como linha propria (como Lancamento)

No `CloserRevenueSummaryTable.tsx`, adicionar uma linha dedicada para A010, similar ao tratamento de "Lancamento":

- Antes de tentar match com closers, verificar se `product_category === 'a010'`
- Redirecionar para linha "A010 - Funil" com icone/cor propria
- Isso remove ~2.238 transacoes do "Sem closer"

### Frente 2: Corrigir dados no banco

**2a. Sincronizar `product_category` em `hubla_transactions`:**
- 449 transacoes "A000 - Contrato" ainda tem `product_category = 'incorporador'` na tabela de transacoes (a migration so corrigiu `product_configurations`)
- Atualizar para `product_category = 'contrato'`

**2b. Tambem separar Contrato e Vitalicio como linhas proprias:**
- `product_category = 'contrato'` -> Linha "Contrato" (pre-venda, R$ 497)
- `product_category = 'ob_vitalicio'` -> Linha "Vitalicio" (order bump)

Isso deixa o "Sem closer" apenas com vendas reais que falharam na atribuicao (parceria, A009, A001, A005 P2) - que sao as que de fato precisam de investigacao.

## Detalhes Tecnicos

### Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

Adicionar 3 novas categorias automaticas alem de "Lancamento":

```text
Hierarquia de roteamento (antes do match com closer):
1. sale_origin === 'launch' -> Lancamento
2. product_category === 'a010' -> A010 - Funil
3. product_category === 'contrato' -> Contrato
4. product_category === 'ob_vitalicio' -> Vitalicio
5. Match por email/telefone com closer -> Closer X
6. Sem match -> Sem closer (agora so vendas reais nao atribuidas)
```

Mudancas no useMemo:
- Criar 3 novos acumuladores (a010Row, contratoRow, vitalicioRow) com IDs especiais (`__a010__`, `__contrato__`, `__vitalicio__`)
- Adicionar verificacao de `product_category` logo apos o check de `sale_origin`
- Estilizar cada linha com cor/icone distinto na tabela

### Migracao SQL

```sql
-- Sincronizar product_category em hubla_transactions para A000 - Contrato
UPDATE hubla_transactions
SET product_category = 'contrato'
WHERE product_name LIKE 'A000 - Contrato%'
  AND product_category != 'contrato';

UPDATE hubla_transactions
SET product_category = 'contrato'
WHERE product_name = '000 - Contrato'
  AND product_category != 'contrato';
```

### Resultado Esperado

Antes:
- Sem closer: 1.547 transacoes / R$ 701k

Depois:
- A010 - Funil: ~2.242 txs / ~R$ 105k (separado)
- Contrato: ~532 txs / ~R$ 264k (separado)
- Vitalicio: ~621 txs / ~R$ 77k (separado)
- Sem closer: ~150 txs / ~R$ 255k (so vendas reais nao atribuidas - parcerias, A009, P2)

O "Sem closer" residual passa a ser acionavel: sao vendas de parceria/A009/P2 que realmente precisam de vinculo manual com um closer.

