## Objetivo
Restringir a automação **Boas-vindas R2 (Contrato Pago)** para disparar **somente para leads da BU Incorporador MCF**, evitando envios para Consórcio, Inside Sales e demais BUs.

## Como o filtro será aplicado

A identificação da BU de um attendee acontece via `meeting_slot_attendees.origin_id` → `crm_origins.id` → `bu_origin_mapping.bu` (ou via `crm_origins.group_id` conforme o mapeamento vigente). A BU alvo é **Incorporador MCF**.

Duas camadas de proteção (defesa em profundidade):

### 1. Filtro no trigger do banco (`trg_notify_attendee_contract_paid`)
Antes de chamar o dispatcher, o trigger valida se o `origin_id` do attendee pertence à BU Incorporador MCF (consultando `bu_origin_mapping`). Se não pertencer, não enfileira o evento.

### 2. Filtro no fluxo (`automation_flows`)
Popular o campo `origin_id` (ou uma lista de origens permitidas) no fluxo `Boas-vindas R2 (Contrato Pago)` com as origens da BU Incorporador MCF. O `automation-event-dispatcher` já respeita esse filtro ao selecionar o fluxo elegível.

## Passos

1. **Migration**
   - Atualizar a função do trigger `notify_attendee_contract_paid()` para consultar `bu_origin_mapping` e só prosseguir quando `bu = 'incorporador_mcf'` (nome exato conforme já usado no projeto).
   - Não altera estrutura de tabelas — só a lógica da função.

2. **Seed / update do fluxo**
   - Atualizar o registro em `automation_flows` do fluxo *Boas-vindas R2 (Contrato Pago)* setando `origin_id` (ou preencher uma restrição equivalente) para a(s) origem(ns) mapeada(s) à BU Incorporador MCF.

3. **Validação (read-only)**
   - Rodar SELECT em `bu_origin_mapping` para confirmar as origens vinculadas à BU Incorporador MCF antes de aplicar.
   - Após a migration, conferir que o fluxo aparece corretamente filtrado no editor `FlowEditorDialog`.

## Fora de escopo
- Nenhuma mudança no template Twilio, no dispatcher edge function, na UI de Automações, nem no comportamento de outras automações.
- Nenhum reenvio retroativo.

## Detalhes técnicos
- Arquivos afetados: 1 migration SQL (função `notify_attendee_contract_paid` + UPDATE em `automation_flows`).
- Nenhuma alteração de frontend necessária.
- Idempotência atual (`boas_vindas_r2_whatsapp_enviado_em`) permanece inalterada.
