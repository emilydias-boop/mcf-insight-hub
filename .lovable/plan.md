## Diagnóstico

A mensagem não foi enviada porque o fluxo "Boas vindas" (`c4957cc5-…`) está com `respect_business_hours = true` e horário 09:00–18:00 BRT. Como o lead entrou em ANAMNESE INCOMPLETA fora desse horário, o enqueue agendou todas as mensagens para **2026-05-18 09:00 BRT**. Hoje há 26 itens `pending` na fila, todos esperando 09:00.

Outros pontos confirmados:
- O trigger SQL está enfileirando corretamente.
- O `automation-processor` roda a cada 5 min e só pega itens com `scheduled_at <= now()`.
- Cada movimentação está gerando **2 itens duplicados** na fila (há dois triggers idênticos: `trg_automation_enqueue` e `trg_automation_enqueue_on_deal`).

## O que vou fazer

### 1. Boas vindas envia sempre (conforme sua escolha)

Desligar o respeito a horário comercial no fluxo "Boas vindas":
- `automation_flows.respect_business_hours = false` para o flow `c4957cc5-a5bd-4e34-abea-bf3b77170d7c`.

Assim, novas entradas em ANAMNESE INCOMPLETA disparam o WhatsApp em até 5 minutos, em qualquer horário/dia.

### 2. Liberar os 26 itens já presos para 09:00

`UPDATE automation_queue SET scheduled_at = now() WHERE status='pending' AND scheduled_at > now()` — o processor pega no próximo ciclo (≤5 min).

### 3. Remover o trigger duplicado (causa do envio em dobro)

Hoje existem dois triggers idênticos em `crm_deals` chamando `automation-enqueue`. Vou manter `trg_automation_enqueue` e remover `trg_automation_enqueue_on_deal`. Isso evita a duplicação que vimos (2 itens iguais por movimentação).

## Detalhes técnicos

Migração única com:
```sql
-- 1) Boas vindas envia sempre
UPDATE public.automation_flows
SET respect_business_hours = false
WHERE id = 'c4957cc5-a5bd-4e34-abea-bf3b77170d7c';

-- 2) Libera fila atual
UPDATE public.automation_queue
SET scheduled_at = now()
WHERE status = 'pending' AND scheduled_at > now();

-- 3) Remove trigger duplicado
DROP TRIGGER IF EXISTS trg_automation_enqueue_on_deal ON public.crm_deals;
```

Sem mudanças de código nem nas edge functions. Os flows que ainda devem respeitar horário comercial (ex.: lembretes de reunião) continuam intactos — a alteração é só no fluxo "Boas vindas".

## Validação

- Após aprovar: aguardo o próximo ciclo do cron (≤5 min) e confirmo no `automation_logs` que as mensagens saíram com `status = 'sent'`.
- Te peço para mover um novo lead para ANAMNESE INCOMPLETA fora do horário comercial — esperado: 1 item na fila (não 2) e envio em até 5 min.
