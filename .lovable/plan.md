

# Limpar Flag de Lancamento - Manter Apenas 25 Clientes

## Situacao Atual

- **587 clientes** marcados com `sale_origin = 'launch'` no banco
- Usuario quer manter **apenas 25 emails especificos** como lancamento
- **562 clientes** precisam ter o `sale_origin` limpo (voltando para `NULL`)

## Acao

Executar um UPDATE no banco de dados para remover `sale_origin = 'launch'` de todas as transacoes **exceto** os 25 emails listados.

## Detalhes Tecnicos

### 1. UPDATE no banco de dados

Atualizar `hubla_transactions` definindo `sale_origin = NULL` onde:
- `sale_origin = 'launch'` 
- `customer_email` NAO esta na lista dos 25 emails aprovados

### 2. Garantir que os 2 emails faltantes recebam a flag

Na analise anterior, 2 emails da lista do usuario nao tinham a flag `launch`:
- `chavesjunior60@gmail.com` (Junior Chaves)
- `arlan_unai45@hotmail.com` (Arlan Rodrigues Rocha)

Esses serao marcados como `sale_origin = 'launch'`.

### 3. Logica de codigo (ja implementada)

A logica de override por R1 no `CloserRevenueSummaryTable.tsx` e `useAcquisitionReport.ts` continua funcionando para cenarios futuros. Como agora so 25 emails terao a flag, a separacao sera naturalmente mais precisa.

## Resultado Esperado

- **Lancamento**: Apenas transacoes dos 25 clientes listados
- **Demais 562 clientes**: Voltam ao fluxo normal de atribuicao (closer, sem closer, etc.)
- Nenhum dado perdido - apenas o campo `sale_origin` e alterado

