

## Duas melhorias no CRM Consorcio: Badge de produto e Reembolso

### 1. Badge: Mostrar produto comprado (nao "A000 - Contrato")

**Problema**: O badge "$ A000 - Contrato" mostra o nome do contrato (que e apenas a formalizacao da compra). Para a equipe de Consorcio, o que importa e saber qual produto/parceria o lead comprou (ex: A001, A009, Anticrise, Clube do Arremate).

**Solucao**: Quando o deal for detectado como "Outside", alem de buscar a transacao de contrato, tambem buscar a transacao de produto principal (nao-contrato) do mesmo email. O badge exibira o nome do produto real em vez do contrato.

**Alteracoes**:

**`src/hooks/useOutsideDetectionForDeals.ts`**

- Adicionar uma segunda query paralela para buscar transacoes completadas do mesmo email que NAO sejam contratos (excluindo `product_name ILIKE '%contrato%'`)
- Para cada email com contrato (outside), buscar o produto mais recente que nao seja contrato
- Priorizar o nome do produto nao-contrato no campo `productName` do resultado
- Se nao houver produto nao-contrato, manter o nome do contrato como fallback

Logica:
```text
1. Query existente: busca contratos (para detectar outside) -> mantem
2. Nova query paralela: busca produtos nao-contrato do mesmo email
3. Resultado: productName = produto nao-contrato ?? nome do contrato
```

### 2. Reembolso disponivel no Drawer do Deal

**Problema**: O RefundModal existe e funciona no contexto de reunioes R2 (Agenda R2, Pending Leads), mas nao esta disponivel no Drawer do Deal no Kanban. A equipe de Consorcio precisa marcar reembolsos diretamente do Negocios.

**Solucao**: Adicionar botao "Solicitar Reembolso" no `QuickActionsBlock` do Drawer. O RefundModal ja suporta `dealId` sem `meetingId` obrigatorio (tem fallback), entao basta adaptar a chamada.

**Alteracoes**:

**`src/components/crm/QuickActionsBlock.tsx`**

- Importar `RefundModal`
- Adicionar estado `showRefundModal`
- Adicionar botao "Solicitar Reembolso" (icone RotateCcw, cor laranja) na area de acoes
- O botao so aparece se o deal NAO tem `reembolso_solicitado` nos custom_fields
- Passar `meetingId=""` (vazio - o modal ja lida com fallback), `dealId`, `dealName`, `originId` e `currentCustomFields`
- Ao concluir o reembolso, chamar `onStageChange()` para atualizar o drawer

**`src/components/crm/RefundModal.tsx`**

- Ajustar para tornar `meetingId` opcional (atualmente obrigatorio na interface)
- Se `meetingId` estiver vazio/nulo, pular a etapa de atualizacao do meeting/attendee e ir direto para a parte do deal (custom_fields + stage change + activity log)

### Resultado esperado

- **Badge**: Em vez de "$ A000 - Contrato", o card mostrara "$ A001" ou "$ Anticrise" ou "$ Clube do Arremate" - o produto real que o lead comprou
- **Reembolso**: Ao abrir o drawer de qualquer deal no Kanban, havera um botao "Solicitar Reembolso" que abre o mesmo modal usado no R2, marcando o deal como reembolsado e movendo para "Perdido"
