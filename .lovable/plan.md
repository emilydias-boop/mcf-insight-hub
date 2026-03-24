

## Diagnóstico: Por que o Felipe não vinculou na Jornada + Discrepância 13 vs 10

### Problema 1: Jornada mostra "Reunião 01 - Não agendada"

O `useIncorporadorLeadJourney` (usado no drawer de Vendas) busca o contato por email, depois procura **deals desse contato** e escolhe o primeiro deal que tem `meeting_slot_attendees`. 

O problema: se o Felipe tem **2 deals** (duplicata ainda não consolidada), o hook pode estar encontrando um deal sem reunião vinculada. O meeting_slot_attendee do Felipe está ligado a um `deal_id` diferente do que o hook está usando.

Isso é exatamente o cenário de duplicatas que discutimos antes. A limpeza completa (full_cleanup) deveria resolver consolidando os deals, mas provavelmente esse caso ainda não foi processado.

### Problema 2: 13 transações vs 10 contratos no painel

Isso é comportamento esperado. O painel de Closers conta `meeting_slot_attendees` com `contract_paid_at IS NOT NULL` (leads vinculados a uma R1). As 3 transações que faltam são leads que:
- Não tinham attendee R1 correspondente (Outside sem reunião)
- O match automático do `hubla-webhook-handler` não encontrou correspondência por email/telefone/nome

O 1 Outside contabilizado é um lead que comprou antes da reunião.

### Correção proposta

**Nenhuma mudança de código necessária** para o problema principal — a causa raiz é a mesma das duplicatas. A solução é:

1. **Executar a "Limpeza Completa"** na página de Contatos Duplicados para consolidar os deals duplicados do Felipe (e outros casos similares)
2. Após a consolidação, o `deal_id` correto terá o `meeting_slot_attendees` vinculado e a jornada aparecerá corretamente

### Para os 3 contratos não vinculados automaticamente

Esses são leads que o auto-pago não conseguiu fazer match. Opções:
- Verificar nos logs do `hubla-webhook-handler` o motivo do não-match
- Vincular manualmente via o botão de "Vincular Contrato" na agenda do closer

### Resumo

| Situação | Causa | Solução |
|----------|-------|---------|
| Jornada "Não agendada" do Felipe | Deal duplicado — meeting está em outro deal_id | Executar Limpeza Completa |
| 13 transações vs 10 contratos | 3 transações sem match automático com R1 attendee | Vincular manualmente ou verificar logs |
| 1 Outside | Lead comprou contrato antes da reunião R1 | Comportamento correto |

