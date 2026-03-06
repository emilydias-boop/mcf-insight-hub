

## Plano: Filtrar parceiros (is_partner) das métricas de Closers

### Problema
O hook `useR1CloserMetrics.ts` (aba "Closers" no painel de equipe) **não filtra** attendees com `is_partner = true`. Isso faz com que sócios adicionados a reuniões sejam contados nas métricas de R1 Agendada, R1 Realizada, No-Show e Outside dos Closers.

A RPC `get_sdr_metrics_from_agenda` (aba SDRs) já filtra corretamente com `AND msa.is_partner = false`.

### Alterações

**`src/hooks/useR1CloserMetrics.ts`**

3 pontos de correção:

1. **Query principal de meetings (linha 82-88)**: Adicionar `is_partner` no select dos attendees para poder filtrar client-side.

2. **Processamento de attendees (linha 420)**: Adicionar check `if (att.is_partner) return;` antes de contar nas métricas (r1_agendada, r1_realizada, noshow).

3. **Query de contratos por data de pagamento (linhas 204-220 e 226-243)**: Adicionar `.eq('is_partner', false)` nas queries de `contractsByPaymentDate` e `contractsWithoutTimestamp`.

4. **Outside detection (linha 356)**: Adicionar check `is_partner` ao contar outsides — precisa buscar `is_partner` nas queries de attendees usadas nessa seção, ou reutilizar o filtro do passo 2 (que já pula outsides de parceiros indiretamente via o map de deals).

### Resultado
Sócios não serão mais contados em nenhuma métrica da aba Closers, mantendo consistência com a aba SDRs.

