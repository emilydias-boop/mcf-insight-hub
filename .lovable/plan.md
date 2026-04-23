

## Sinalizar duplicados existentes + bloquear novos duplicados

### Decisão

Em vez de mesclar os ~3.193 grupos existentes (risco de falsos positivos, custo alto), vamos:

1. **Manter os duplicados atuais como estão**, apenas sinalizando visualmente com badge "Dup" no Kanban e na lista de contatos.
2. **Travar a criação de novos duplicados** em todos os pontos de entrada (webhooks, importação, criação manual).

### Etapa 1 — Sinalização visual dos duplicados existentes

**Backend: nova RPC `get_duplicate_contact_ids`**

Função SQL (security definer, stable) que retorna a lista de `contact_ids` que são duplicados (compartilham email lowercase OU sufixo de telefone com outro contato ativo).

```sql
create or replace function public.get_duplicate_contact_ids()
returns table(contact_id uuid)
language sql stable security definer set search_path = public as $$
  with sufixos as (
    select id, lower(email) as email_norm,
           right(regexp_replace(coalesce(phone,''),'\D','','g'), 9) as phone_suf
    from crm_contacts
    where coalesce(is_archived,false) = false
  ),
  dups_email as (
    select id from sufixos
    where email_norm is not null and email_norm <> ''
      and email_norm in (select email_norm from sufixos
                         where email_norm is not null and email_norm <> ''
                         group by email_norm having count(*) > 1)
  ),
  dups_phone as (
    select id from sufixos
    where length(phone_suf) = 9
      and phone_suf in (select phone_suf from sufixos
                        where length(phone_suf) = 9
                        group by phone_suf having count(*) > 1)
  )
  select id from dups_email union select id from dups_phone;
$$;
```

Cacheada por 5min em hook React: `useDuplicateContactIds()`.

**Frontend**

- `src/hooks/useContactsEnriched.ts` (linha 190): trocar `isDuplicate: false` por `isDuplicate: duplicateSet.has(contact.id)` usando o set retornado pela RPC.
- `src/components/crm/ContactCard.tsx`: badge "Dup" já existe (linha 98-103) — só passa a aparecer naturalmente.
- Adicionar tooltip no badge: "Existe outro contato com mesmo email ou telefone. Clique para ver."
- Opcional: filtro "Mostrar só duplicados" na barra de filtros do `/crm/contatos` para o admin auditar manualmente.

### Etapa 2 — Bloquear criação de novos duplicados

**Auditoria dos pontos de entrada**

| Origem | Já protege? | Ação |
|---|---|---|
| `webhook-lead-receiver` | Sim (`check_duplicate_deal_by_identity`) | Manter |
| `webhook-live-leads` | Sim | Manter |
| `import-spreadsheet-leads` | Sim | Manter |
| `hubla-webhook-handler` | Sim (busca por email/telefone antes de criar) | Manter |
| `webhook-make-a010` | Sim (fallback por email + sufixo) | Manter |
| **Criação manual no CRM** (`DealCreateModal` / similar) | A verificar | **Adicionar checagem** |
| **Edição de contato** (mudar email/telefone) | Não | **Adicionar checagem** |

**Mudanças**

1. **Reforçar `check_duplicate_deal_by_identity`** se ainda não cobre busca a nível de **contato** (não só deal): criar variante `check_duplicate_contact_by_identity(p_email, p_phone_suffix)` que retorna `contact_id` existente se houver match. Já usar a contact match em vez de criar um novo.

2. **Criação manual de lead/deal no CRM** (`src/components/crm/CreateLeadModal.tsx` ou equivalente):
   - Antes de inserir em `crm_contacts`, chamar `check_duplicate_contact_by_identity`.
   - Se retornar match: avisar "Já existe um contato com esse email/telefone: [Nome]. Deseja usar o existente?" com botões "Usar existente" (cria deal vinculado ao contact_id existente) ou "Cancelar".

3. **Edição de email/telefone em contato existente**:
   - Validar se o novo valor não colide com outro contato ativo.
   - Se colidir: mostrar erro "Email/telefone já pertence a outro contato (Nome). Considere mesclar manualmente."

4. **Constraint de banco (proteção final)**:
   - Índice único parcial: `create unique index crm_contacts_email_active_uniq on crm_contacts (lower(email)) where is_archived = false and email is not null and email <> '';`
   - Idem para sufixo de telefone:  
     `create unique index crm_contacts_phone_suffix_active_uniq on crm_contacts ((right(regexp_replace(phone,'\D','','g'), 9))) where is_archived = false and length(regexp_replace(phone,'\D','','g')) >= 9;`
   - **Importante**: criar com `CREATE UNIQUE INDEX CONCURRENTLY` em migration separada **só depois** de resolver os 116 grupos suspeitos (senão a criação do índice falha). Como decisão atual é não mexer nos existentes, esta etapa fica como **opcional/futura**. No curto prazo, a proteção é puramente em código (nas edge functions e no frontend).

### Etapa 3 — Tela de auditoria opcional (recomendada)

Página `/admin/duplicados` listando os ~3.193 grupos com:
- Nomes, emails, telefones lado a lado.
- Badge de severidade (mesmo email = certeza, só sufixo = suspeito).
- Botões: "Mesclar este grupo" (chama edge function pontualmente), "Marcar como pessoas diferentes" (adiciona a uma lista de exceções para parar de aparecer).

Permite resolver caso a caso, no ritmo da operação, sem ação em massa.

### Resumo do que vai ser feito agora

1. **Migration**: criar funções `get_duplicate_contact_ids()` e `check_duplicate_contact_by_identity()`.
2. **Hook**: `src/hooks/useDuplicateContactIds.ts` (cache 5min).
3. **Hook existente**: `useContactsEnriched.ts` — popular `isDuplicate` real.
4. **UI**: tooltip no badge "Dup" do `ContactCard`; filtro "Só duplicados" na lista.
5. **Criação manual**: localizar modal/form de criação de lead no CRM e adicionar checagem antiduplicata com diálogo de "usar existente".
6. **Edição de contato**: validação no form de edição de email/telefone.

Etapa 3 (tela `/admin/duplicados`) e índice único de banco ficam como próximas etapas opcionais — confirmo antes de fazer.

### Reversibilidade

Nada destrutivo. Sinalização é só leitura. Bloqueios novos podem ser desligados removendo a checagem, sem afetar dados existentes.

