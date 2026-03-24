

## Diagnóstico: Por que a Anna aparece 2x no Consórcio

### Causa raiz

O fluxo de deduplicação do `webhook-lead-receiver` funciona assim:

1. Busca contato existente por: **CPF → email → telefone (9 dígitos) → telefone (8 dígitos)**
2. Se encontrar, usa o `contact_id` existente
3. Verifica se já existe um deal para `contact_id + origin_id` — se sim, apenas atualiza tags/profile
4. Se não encontrar contato, **cria um novo contato E um novo deal**

**O problema**: Se a mesma pessoa entra em dias diferentes com dados ligeiramente diferentes (ex: sem email na 1ª vez, com email na 2ª; ou telefone com/sem DDD), o sistema **não consegue fazer match** e cria dois contatos separados → dois deals.

Além disso, a busca por telefone usa `ilike('%suffix')` com `.maybeSingle()` — se houver **múltiplos matches** de telefone, a query **falha silenciosamente** e cai no fluxo de "novo contato".

### Problemas identificados

1. **`maybeSingle()` na busca por telefone** — se 2+ contatos compartilham o mesmo sufixo de telefone, retorna `null` em vez de pegar o primeiro match
2. **Sem busca por nome** — se email e telefone são diferentes mas o nome é idêntico + mesma origin, não há fallback
3. **Tags sobrescritas** no update de contato (linha 250): `tags: autoTags` substitui as tags existentes em vez de fazer merge

### Plano de correção

#### 1. Corrigir `maybeSingle()` → usar `.limit(1).maybeSingle()` ou `.order().limit(1)`
Na busca por telefone (linhas 201-205 e 219-223), trocar para busca que retorna o match mais recente em vez de falhar quando há múltiplos.

#### 2. Adicionar fallback de dedup por nome + origin
Após falhar CPF/email/telefone, buscar contato existente por `name` (ilike exato) na mesma `origin_id`. Isso captura o caso da "Anna" que entra 2x com dados parciais diferentes.

#### 3. Corrigir merge de tags no update de contato
Linha 250: em vez de `tags: autoTags`, fazer merge com as tags existentes do contato (buscar tags atuais e unir).

#### 4. Adicionar log de warning quando dedup falha
Registrar em `bu_webhook_logs` quando um contato é criado mas já existe um com nome similar na mesma pipeline, para facilitar auditoria.

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/webhook-lead-receiver/index.ts` | Corrigir `maybeSingle` na busca telefone; adicionar fallback por nome+origin; corrigir merge de tags; adicionar warning log |

### O que NÃO muda
- Fluxo de dedup por CPF e email (já funciona)
- Lógica de dedup de deal (contact_id + origin_id)
- Dedup manual na página Contatos Duplicados
- Nenhum arquivo de frontend

### Resultado esperado
Leads como "Anna" que entram 2x na mesma pipeline serão reconhecidos como o mesmo contato (via telefone tolerante ou nome exato), evitando duplicatas no Kanban.

