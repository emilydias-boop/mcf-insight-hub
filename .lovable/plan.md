

# Separar Vendas de Launch vs Inside Sales

## Contexto

Atualmente, **todas** as transacoes com `sale_origin = 'launch'` vao para o bucket "Lancamento". Porem, 22 clientes marcados como launch **tambem passaram pelo funil Inside Sales** (tem R1 agendada com closer). Esses devem ser atribuidos ao closer correspondente, nao ao lancamento.

**Dados de Fevereiro 2026:**
- **69 transacoes** (22 clientes) tem R1 no CRM = devem ir para o closer (Inside Sales)
- **107 transacoes** (34 clientes) sem R1 = lancamento puro

## Logica Proposta

No `CloserRevenueSummaryTable.tsx` e `useAcquisitionReport.ts`, antes de classificar uma transacao como "Lancamento", verificar se o email/telefone do cliente tem match com algum attendee R1. Se tiver, a transacao **nao** e isolada como lancamento - ela segue o fluxo normal de atribuicao ao closer.

```text
// Pseudocodigo
if (tx.sale_origin === 'launch') {
  // Verificar se tem R1 meeting (passou pelo inside sales)
  const hasR1Match = emailMap.has(txEmail) || phoneMap.has(txPhone);
  if (hasR1Match) {
    // NAO isolar como launch - deixar fluir para match com closer
  } else {
    // Launch puro - isolar na linha de Lancamento
  }
}
```

## Alteracoes Tecnicas

### 1. `src/components/relatorios/CloserRevenueSummaryTable.tsx`

**Linhas 142-149** - Modificar a condicao de launch para verificar se o cliente tem match no mapa de contatos dos closers antes de isolar:

- Mover o check de launch para DEPOIS de construir o `closerContactMap`
- Se `sale_origin === 'launch'` MAS o email ou telefone esta no mapa de algum closer, deixar a transacao seguir para o match normal (passo 5)
- Apenas se NAO tiver match com nenhum closer, classificar como Lancamento

### 2. `src/hooks/useAcquisitionReport.ts`

**Linhas 22-24 e 276-293** - Aplicar a mesma logica:

- No `classifyOrigin`, manter a classificacao como 'Lancamento' 
- No passo de classificacao (linha 282), quando `origin === 'Lancamento'`, verificar se existe match nos mapas `emailToAttendees` ou `phoneToAttendees`
- Se tiver match, tratar como transacao normal (nao automatica), permitindo atribuicao ao closer

### 3. Contrato MCF

A condicao `product_name.includes('contrato mcf')` tambem sera afetada pela mesma logica: se o cliente de um "Contrato MCF" tem R1 meeting, ele sera atribuido ao closer em vez de ir para Lancamento.

## Resultado Esperado

- **Lancamento**: ~107 transacoes de clientes que compraram diretamente no dia 03/02 sem passar pelo funil
- **Closers**: ~69 transacoes de clientes que vieram do launch mas passaram pelo Inside Sales (R1) e foram atendidos por closers
- Nenhuma perda de dados - todas as transacoes continuam visiveis, apenas re-categorizadas

