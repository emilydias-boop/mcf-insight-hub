# Onda 3 (revisada) — Âncora detectada automaticamente pelo stage

Mudança de filosofia: o usuário **nunca configura âncora**. O sistema decide sozinho qual data usar como referência olhando o **nome do stage** ao qual o flow está vinculado.

Resultado: editor de Step continua igual ao de hoje (canal + template + delay + ativo). Zero novo campo na UI. A inteligência fica escondida no `automation-enqueue`.

---

## Como a detecção funciona

Quando um deal entra num stage e dispara um flow, o `automation-enqueue` consulta o `stage_name` e classifica em uma de 4 âncoras via regex (case + accent-insensitive):

| Padrão no nome do stage | Âncora aplicada | Significado prático |
|---|---|---|
| contém `reunião agendada`, `r1 agendada`, `r2 agendada`, `1ª reunião agendada`, `2ª reunião agendada` | `meeting_start` | "delay" do step passa a contar **a partir do horário da reunião** (negativo = antes). |
| contém `reunião realizada`, `r1 realizada`, `r2 realizada` | `meeting_end` | conta a partir do fim da reunião (followup pós-call). |
| contém `contrato pago`, `consórcio fechado`, `fechado`, `convertido`, `1° parcela paga` | `contract_paid_at` | conta a partir do pagamento (boas-vindas, onboarding). |
| qualquer outro stage | `enqueue_time` | comportamento atual — conta a partir de quando o lead caiu no flow. |

A tabela de regras vive como **constante no código do edge function** (fácil ajustar). Não há UI nem tabela de banco para configurar isso — é convenção.

## Como o "delay" passa a ser interpretado

Hoje o usuário preenche `delay_days/hours/minutes` (sempre positivo). Com a detecção automática:

- Stage tipo **enqueue_time** → mesmo comportamento de hoje (delay positivo somado a "agora").
- Stage tipo **meeting_start / meeting_end / contract_paid_at** → o delay vira **offset relativo à âncora**.
  - Convenção: se o nome do flow ou step contém palavras-chave como `lembrete`, `confirmação`, `antes` → **offset negativo** (ex: 1h antes da reunião).
  - Se contém `followup`, `pós`, `depois`, `recovery` → **offset positivo** (ex: 30 min depois).
  - Se nada disso, default é **positivo** (mantém retrocompatibilidade).

Como **não existe no editor** um sinal claro de "antes vs depois", a forma mais limpa é: **nome do flow** decide. O usuário já nomeia flows tipo "Lembrete R1 1h antes" ou "Followup pós-R1 30min", então a heurística é natural.

> Opção alternativa (se quiser mais previsível): em vez de heurística por nome, tratar todo step de stage de reunião como `meeting_start - delay` (sempre **antes**) e todo step de `meeting_end / contract_paid_at` como `+delay` (sempre **depois**). Mais simples, menos mágico. Eu **recomendo essa**.

## Salvaguardas automáticas (sem UI)

1. **min_lead_time = 15 min** fixo: se a âncora calculada cair no passado ou em menos de 15 min, o step é skippado (não envia mensagem atrasada).
2. **Reunião cancelada/no-show** → o `automation-processor` revalida no T+0 lendo `meeting_slots.status` e cancela o envio se a reunião não está mais ativa.
3. **`respect_business_hours`** continua respeitando o que o flow já tem configurado (zero mudança aqui).
4. **Sem âncora disponível** (ex: stage de reunião mas o deal não tem `meeting_slots`) → fallback automático para `enqueue_time` (comportamento atual). Nunca quebra.

## O que muda no banco

Os campos `anchor`, `offset_minutes`, `min_lead_time_minutes`, `step_kind` da Onda 2 **continuam existindo mas viram cache/auditoria**: o enqueue grava neles o que **detectou** para cada step quando agendou (útil para debug nos logs/admin). Não precisa de UI para editar.

`respect_send_window` da Onda 2 não é usado nesta onda (fica reservado pro futuro).

## O que muda no código

**1. `automation-enqueue/index.ts`**
- Nova função `detectAnchorFromStage(stageName)` → retorna `{anchor, defaultDirection: 'before'|'after'}`.
- Nova função `resolveAnchorTime(deal, anchor, supabase)` → busca `meeting_slots.scheduled_at` ou `crm_deals.contract_paid_at` conforme a âncora; retorna `null` se não houver.
- Bloco de cálculo do `scheduledAt`:
  - Se âncora ≠ enqueue_time **e** anchor time existe → `scheduledAt = anchorTime ± delay`.
  - Senão → fallback `now() + delay` (comportamento atual).
- Skip se `scheduledAt < now() + 15min`.
- Persiste no `automation_queue` o `anchor` resolvido + `scheduled_at` final (já tem coluna `anchor_resolved` se quiser; senão fica só nos logs).

**2. `automation-processor/index.ts`**
- Antes de enviar, se o step tinha âncora `meeting_start`/`meeting_end`, relê `meeting_slots.status` do deal.
- Se status ∈ `cancelled`, `no_show`, `rescheduled` → marca queue item como `cancelled` com motivo `meeting_no_longer_active` e pula.

**3. UI — zero mudança.** `StepEditorDialog`, `FlowList`, `AutomationSettings`: tudo igual.

**4. (Opcional) `AutomationLogs`** — adicionar uma colunazinha "Âncora detectada" lendo o campo `anchor` que o enqueue gravou. Ajuda admin a entender o que aconteceu sem nova configuração.

## Validação (rodada manual após implementação)

1. Flow ativo num stage tipo `LEAD A` (sem âncora) → comportamento idêntico ao de hoje. ✅
2. Flow novo de teste no stage `1ª Reunião Agendada` com delay 1h → enviado **1h antes** do `meeting_slots.scheduled_at`. ✅
3. Mesmo cenário, mas reunião marcada como `no_show` antes do envio → mensagem cancelada no processor. ✅
4. Stage `1ª Reunião Agendada` mas deal sem meeting_slot → fallback `enqueue_time`, não quebra. ✅
5. `automation_logs` mostra `anchor=meeting_start` no detalhe. ✅

## Impacto em métricas
**Zero.** Nada toca em `meeting_slots`, `crm_deals`, `calls`, `sdr_squad_history`, performance ou fechamento. Só altera `scheduled_at` dos itens em `automation_queue`.

## Fora de escopo
- UI para editar âncora (não existe — é automática).
- Tabela `automation_routing_rules` (continua vazia — Onda 4+).
- Trigger SQL em `meeting_slots` (continua sendo cron — Onda 5).
- Desligar `meeting-reminders-cron` (Onda 5, depois de validar em produção).

---

**Decisão pendente** que afeta a implementação: usar **regra simples** (stage de reunião = sempre **antes**, stage de fim/pagamento = sempre **depois**) **ou** **heurística por nome do flow** (palavras-chave decidem direção)? Recomendo a regra simples — mais previsível, sem surpresas.