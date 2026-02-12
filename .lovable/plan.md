
# Análise Detalhada de "Sem Closer" + Dashboard de Diagnóstico

## Problema
Transações "Sem closer" (75% dos casos) representam vendas que não puderam ser atribuídas a nenhum closer R1. A causa pode ser:
1. **Falha de Código**: Não conseguiu fazer match de email/telefone por divergência de dados
2. **Legítimo**: Cliente nunca teve reunião R1 (vendas diretas, A010, etc.)

Atualmente não há forma de distinguir entre os dois casos.

## Solução em 2 Partes

### Parte 1: Detalhar a Modal "Sem Closer" (UI)

Modificar o `CloserRevenueDetailDialog` para quando `closerId === '__unassigned__'`, mostrar:

1. **Tabela de Transações "Sem Closer"** com colunas:
   - Email (com badge de warning se vazio)
   - Telefone (com badge de warning se vazio)
   - Produto
   - Valor Bruto
   - Status

2. **Filtros para diagnóstico**:
   - Agrupar por "Motivo da Não-Atribuição":
     - ✗ Sem Email (badge em vermelho)
     - ✗ Sem Telefone (badge em vermelho)
     - ⚠ Email + Telefone vazios (crítico)
     - ℹ Email/Telefone presente mas sem match

3. **Cards de KPI** para "Sem Closer":
   - Total de transações
   - Valor que deixou de ser atribuído
   - % com dados faltando (email/telefone)
   - % com dados presentes mas sem match

### Parte 2: Hook de Análise de Diagnóstico

Criar hook `useUnassignedTransactionsDiagnosis.ts` que categoriza cada transação:

```typescript
interface UnassignedTransactionDiagnosis {
  reason: 'missing_email' | 'missing_phone' | 'both_missing' | 'no_match';
  transaction: Transaction;
  hasCloserInCRM?: boolean; // se encontrou no CRM mas não matching
  suggestedCloser?: string; // fuzzy match do telefone/email
}
```

O hook fará:
1. Para cada transação "Sem closer":
   - Verificar se email/telefone está vazio → categoriza como "missing"
   - Se tem dados, fazer fuzzy match contra todos os contacts no CRM → categoriza como "no_match"
   - Se encontrou contact no CRM mas sem closer vinculado → adiciona nota "contact existe mas sem reunion"

### Parte 3: Análise Adicional na Modal

Dentro da modal de "Sem Closer", ao clicar em uma transação:
- Mostrar um drawer com:
  - **Dados Brutos**: Email, Telefone exatos como vieram da Hubla
  - **Matching Manual**: Campo para buscar/sugerir um closer
  - **Histórico CRM**: Se existe contato/deal no CRM, mostrar links
  - **Ação**: Botão para "Atribuir Manualmente" ao closer (salva em `linked_attendee_id`)

## Benefícios

1. **Visibilidade**: Entender exatamente por que uma venda não foi atribuída
2. **Data Quality**: Identificar erros de input (emails/telefones inválidos)
3. **Resolução**: Permitir atribuição manual com um clique
4. **Auditoria**: Registrar quem fez a atribuição e quando

## Ordem de Implementação

1. Criar `useUnassignedTransactionsDiagnosis.ts` com lógica de categorização
2. Estender `CloserRevenueDetailDialog` para mostrar detalhamento quando `closerId === '__unassigned__'`
3. Adicionar tabela de transações com filtros e razão de não-atribuição
4. Adicionar drawer de detalhe ao clicar em uma transação
5. Opcional: Criar página `/bu-incorporador/diagnostico-sem-closer` para visão consolidada de todos os períodos

## Arquivos a Criar
- `src/hooks/useUnassignedTransactionsDiagnosis.ts`
- `src/components/relatorios/UnassignedTransactionsDetailPanel.tsx`

## Arquivos a Modificar
- `src/components/relatorios/CloserRevenueDetailDialog.tsx` (adicionar condicional para "Sem Closer")
