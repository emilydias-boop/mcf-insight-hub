
## Objetivo
Fazer “Pendentes” e “No‑Shows” refletirem a realidade do banco (inclusive em casos antigos), corrigindo dois problemas de lógica:
1) Pendentes filtra por `deal_id`, mas existem casos onde o R1 (Contrato Pago) está em um `deal_id` e o R2 aconteceu em outro `deal_id` (mesmo contato). Ex.: **Silas Cavalheiro**.
2) No‑Shows (lista e contador) contam registros `no_show` mesmo quando já existe um reagendamento criado como “filho” (`parent_attendee_id`). Ex.: **Odesmar Martins da Silva Júnior** tem um `no_show` original + um novo attendee “rescheduled”.

---

## Diagnóstico confirmado (com dados do banco)
### Caso “Silas Cavalheiro”
- R1 `contract_paid` está no deal **49396fe1-...**
- R2 `completed` está no deal **3565446f-...**
- Ambos apontam para o mesmo `contact_id` **779c8061-...**
Ou seja: o filtro atual de Pendentes (por `deal_id`) não consegue perceber que o contato já fez R2.

### Caso “Odesmar Martins da Silva Júnior”
- Existe um attendee `no_show` (original)
- Existe um attendee `rescheduled` com `parent_attendee_id = (id do no_show)`
Mesmo que o reagendamento exista, o hook de No‑Shows continua listando/contando o original.

---

## Mudanças propostas (código)
### 1) Corrigir lógica de “Pendentes” para deduplicar por contato (contact_id) e não só por deal_id
**Arquivo:** `src/hooks/useR2PendingLeads.ts`

**Como ficará a regra:**
- Continuamos buscando os R1 com `status = contract_paid`.
- Em vez de excluir apenas por “há R2 para o mesmo `deal_id`”, passaremos a excluir por:
  - “há qualquer R2 (qualquer status válido) para qualquer deal que pertença ao mesmo `contact_id` do lead pendente”.

**Implementação (passos):**
1. No resultado de `paidAttendees`, extrair:
   - `deal_id` (como já faz)
   - `contact_id` a partir de `deal.contact.id` (já vem no select, vamos garantir tipagem/uso).
2. Buscar todos os deals pertencentes a esses `contact_id`:
   - `select id, contact_id from crm_deals where contact_id in (...)`
3. Com a lista de `deal.id` desses contatos, buscar R2 existentes:
   - `meeting_slot_attendees` com `deal_id in (...)` e `meeting_slots.meeting_type = 'r2'`
4. Marcar `contact_id` como “já tem R2” se qualquer deal daquele contato tiver R2.
5. Filtrar pendentes removendo todos que pertencem a um `contact_id` que “já tem R2”.

**Resultado esperado:**
- Silas (e todos os casos “mesmo contato, outro deal”) somem de Pendentes.

---

### 2) Corrigir lista de No‑Shows para ignorar no‑shows que já foram reagendados (via parent_attendee_id)
**Arquivo:** `src/hooks/useR2NoShowLeads.ts`

**Problema atual:**
- A query busca `meeting_slot_attendees.status = 'no_show'` e transforma em cards.
- Não há filtro para remover `no_show` que já possui um “filho” reagendado (`meeting_slot_attendees.parent_attendee_id = <id do no_show>`).

**Implementação (sem precisar mudar banco/RPC):**
Após carregar os meetings:
1. Coletar todos os IDs de attendees `no_show` retornados.
2. Fazer uma segunda query:
   - `select parent_attendee_id from meeting_slot_attendees where parent_attendee_id in (<noShowIds>)`
3. Criar um Set `rescheduledParents` com os `parent_attendee_id` encontrados.
4. Na transformação final, **pular** qualquer attendee `no_show` cujo `id` esteja em `rescheduledParents`.

**Resultado esperado:**
- Odesmar deixa de aparecer em No‑Shows, porque o no_show dele tem um reagendamento filho.

---

### 3) Corrigir o contador de No‑Shows para aplicar a mesma regra (excluir no‑shows já reagendados)
**Arquivo:** `src/hooks/useR2NoShowLeads.ts` (hook `useR2NoShowsCount`)

**Problema atual:**
- O contador usa `count: 'exact'` direto no PostgREST, que não permite excluir “no_show com filho” sem SQL.

**Implementação (robusta, com pequeno custo):**
1. Buscar os `id` dos `no_show` (em vez de `head: true`) dentro da janela (últimos 30 dias), como array:
   - `select id` com join `meeting_slots!inner` filtrando `meeting_type='r2'` e `scheduled_at >= ...`
2. Se não houver IDs, retorna 0.
3. Buscar filhos:
   - `select parent_attendee_id from meeting_slot_attendees where parent_attendee_id in (<noShowIds>)`
4. Contar = `noShowIds.length - unique(parent_attendee_id).size`

**Resultado esperado:**
- O badge de No‑Shows diminui automaticamente em casos como Odesmar (inclusive para registros antigos).

---

## Mudanças propostas (comportamento)
- “Deve sumir ao agendar”: Pendentes passa a sumir mesmo com inconsistência de deal (desde que o contato já tenha R2).
- “No‑shows remover do no‑show”: qualquer no_show que já foi reagendado (por vínculo `parent_attendee_id`) deixa de contar e de aparecer.

---

## Arquivos que serão alterados
1. `src/hooks/useR2PendingLeads.ts`
2. `src/hooks/useR2NoShowLeads.ts`

---

## Testes (passo a passo)
1. Recarregar `/crm/agenda-r2` (hard refresh).
2. Abrir aba “Pendentes”:
   - Confirmar que **Silas Cavalheiro** não aparece mais.
3. Abrir aba “No‑Shows”:
   - Confirmar que **Odesmar Martins da Silva Júnior** não aparece mais.
4. Reproduzir um caso real:
   - Marcar um R2 como `no_show` → confirmar que entra na lista/contador
   - Reagendar esse `no_show` (criando filho) → confirmar que o original some da lista/contador imediatamente.
5. Validar que Pendentes ainda funciona para leads realmente sem R2.

---

## Observações técnicas (para evitar regressão)
- Essa correção é intencionalmente “tolerante” a dados inconsistentes: se o CRM gerar múltiplos deals para o mesmo contato, Pendentes não vai sugerir agendamento duplicado.
- O contador de No‑Shows deixa de usar `head: true` para permitir a exclusão de registros com filhos; se o volume ficar alto, podemos evoluir para uma RPC SQL (otimização), mas primeiro vamos corrigir a lógica com impacto mínimo no backend.
