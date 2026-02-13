

# Corrigir Atribuicao de Contratos aos Closers

## Diagnostico

A linha "Contrato" (273 transacoes / R$ 128k) esta isolando vendas que deveriam ser creditadas aos closers. Dados de janeiro:

- **886 transacoes** de contrato no total
- **73** sao de lancamento (ja vao para a linha Lancamento)
- Das **813 restantes**, **480 clientes (88%)** possuem match com closer na agenda
- Apenas **66 clientes (~12%)** nao possuem nenhum match

O problema: na hierarquia atual, `product_category === 'contrato'` intercepta TODAS as transacoes antes de tentar o match com closer. Contratos sao vendas reais fechadas por closers (R$ 497 de adesao), diferente de A010 (R$ 47 automatico) ou Vitalicio (order bump).

## Solucao

Remover a verificacao de `product_category === 'contrato'` da hierarquia de auto-categorizacao no `CloserRevenueSummaryTable.tsx`. Contratos passarao pelo fluxo normal de match com closers:

```text
Hierarquia atualizada:
1. sale_origin === 'launch' -> Lancamento (mantem)
2. product_category === 'a010' -> A010 - Funil (mantem)
3. product_category === 'ob_vitalicio' -> Vitalicio (mantem)
4. REMOVIDO: product_category === 'contrato' (nao intercepta mais)
5. Match por email/telefone com closer -> Closer X (contratos caem aqui)
6. Sem match -> Sem closer (so os ~12% sem agenda)
```

## Mudancas no Codigo

### Arquivo: `src/components/relatorios/CloserRevenueSummaryTable.tsx`

- Remover o bloco de verificacao `product_category === 'contrato'` (linhas ~134-140)
- Remover o acumulador `contrato` e suas variaveis (`contratoRow`, `contratoTxs`, `__contrato__`)
- Remover a entrada de "Contrato" da lista `autoCategories`
- Remover a estilizacao da linha Contrato no JSX (cor verde-esmeralda e icone)

## Resultado Esperado

- ~240 transacoes de contrato serao redistribuidas para as linhas dos closers (Cristiane, Julio, Thayna, etc.)
- ~33 transacoes sem match permanecem em "Sem closer"
- Closers passam a receber credito correto por seus contratos
- Vendas "Outside" de contrato (sale_date < scheduled_at) aparecerao nas colunas Outside
- A linha "Contrato" desaparece da tabela
