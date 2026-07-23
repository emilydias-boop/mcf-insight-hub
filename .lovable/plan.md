## Diagnóstico confirmado

Os links dos closers **existem sim** para William, Leticia e Julio.

O problema não é falta de link em `closer_meeting_links`. O problema é que o `automation-processor` está buscando reunião apenas em:

```text
meeting_slots.deal_id = deal_id
```

Mas os agendamentos recentes estão vinculados assim:

```text
meeting_slot_attendees.deal_id = deal_id
meeting_slot_attendees.meeting_slot_id -> meeting_slots.id
```

Ou seja: o lead está dentro da reunião como attendee, mas o `meeting_slots.deal_id` está vazio. Por isso a automação não encontra o slot, não chega no closer/horário, e cancela com:

```text
meeting_link_unresolved
```

Confirmei em exemplos reais:

- Carlos Melo -> William Ferreira -> 24/07 16:45 -> link encontrado se buscar via attendee.
- FELIPY FREIRE -> Julio -> 25/07 10:15 -> link encontrado se buscar via attendee.
- Terence Douglas Costa -> Leticia Faustino C -> 24/07 10:15 -> link encontrado se buscar via attendee.

## O que vou corrigir

### 1. Ajustar a busca da reunião no `automation-processor`

Hoje ele só consulta `meeting_slots` por `deal_id`.

Vou alterar para esta ordem:

1. Buscar slot ativo via `meeting_slot_attendees.deal_id`.
2. Se não encontrar, buscar via `meeting_slots.deal_id` como fallback antigo.
3. Se ainda não encontrar, buscar via `meeting_slots.contact_id`.

Assim ele passa a funcionar para o modelo atual da agenda, onde a reunião pode ter múltiplos participantes.

### 2. Preservar a resolução atual dos links

Depois que encontrar o slot correto, manter a regra já existente:

1. Link exato por closer + dia + horário em `closer_meeting_links`.
2. Link mais próximo em até 30 minutos.
3. `meeting_slots.meeting_link`.
4. `meeting_slots.video_conference_link`.
5. Qualquer link ativo do closer como fallback final.

### 3. Melhorar o erro gravado na fila

Quando falhar, gravar uma mensagem mais clara, por exemplo:

```text
meeting_link_unresolved:no_active_slot_found
meeting_link_unresolved:no_link_for_slot
```

Assim a próxima investigação mostra se o problema foi “não achou reunião” ou “achou reunião, mas não achou link”.

### 4. Reprocessar os cancelados recentes

Depois da correção, posso reabrir os itens recentes cancelados com `meeting_link_unresolved`, voltando para `pending`, para o processor tentar enviar novamente sem precisar reagendar manualmente.

## Resultado esperado

As mensagens de confirmação R1 devem voltar a puxar os links já cadastrados para William, Leticia e Julio, porque o processor passará a localizar a reunião pelo attendee correto.