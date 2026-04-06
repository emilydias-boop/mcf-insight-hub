

# Corrigir race condition na criacao de contatos e deals no webhook

## Diagnostico

O problema e **sistemico** e afeta todos os novos leads, nao apenas o Adriano Rodrigues. Nos ultimos 6 dias, **126 contatos foram criados sem nenhum deal**. So hoje (06/04), 16 contatos ficaram orfaos.

### Causa raiz

A tabela `crm_contacts` **nao tem unique constraint em `email`**. Quando dois webhooks chegam simultaneamente (ex: `NewSale` + `invoice.payment_succeeded`), ambos:

1. Buscam contato por email → nao encontram (ainda nao existe)
2. Cada um cria um contato DIFERENTE (com `clint_id` aleatorio diferente)
3. Cada um tenta criar deal com seu `contact_id` diferente
4. O unique index `(contact_id, origin_id)` nao conflita porque os contact_ids sao diferentes
5. Por razoes de timing, um ou ambos falham silenciosamente, resultando em 0 deals

O fallback que implementamos na ultima vez nao funciona porque o problema esta ANTES — na duplicacao de contatos.

## Solucao em 2 partes

### Parte 1: Proteger criacao de contato contra race condition

**Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`**

Na secao de criacao de contato (linhas 410-428), substituir o INSERT simples por:

1. Tentar INSERT com `ON CONFLICT` no email (precisa de unique index parcial)
2. Se falhar, fazer SELECT para buscar o contato que acabou de ser criado pelo outro evento
3. Usar o contact_id encontrado para prosseguir

**Alternativa mais robusta** (sem alterar schema): Envolver a busca + criacao de contato em logica de retry:
- Apos o INSERT, se obtiver erro de constraint ou se o contato ja existir, buscar novamente por email
- Isso garante que ambos os eventos usem o MESMO contact_id

### Parte 2: Migration — Adicionar unique index parcial em email

**Nova migration SQL:**

```sql
-- Limpar contatos duplicados primeiro (manter o mais antigo)
DELETE FROM crm_contacts 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(email) ORDER BY created_at ASC) as rn
    FROM crm_contacts
    WHERE email IS NOT NULL
  ) sub WHERE rn > 1
  AND id NOT IN (SELECT contact_id FROM crm_deals WHERE contact_id IS NOT NULL)
);

-- Criar unique index parcial (apenas para emails nao-null)
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_email_unique 
ON crm_contacts (lower(email)) 
WHERE email IS NOT NULL;
```

**Importante:** Antes de deletar duplicados, verificar quais tem deals associados para nao perder dados.

### Parte 3: Webhook handler — usar upsert no contato

**Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`**

Alterar a criacao de contato (linhas 410-428) para:

```
INSERT INTO crm_contacts (...) VALUES (...)
ON CONFLICT (lower(email)) WHERE email IS NOT NULL
DO UPDATE SET updated_at = now()
RETURNING id
```

Ou via Supabase client: usar `.upsert()` com `onConflict: 'email'` apos o index existir.

Isso garante que mesmo com 2 eventos simultaneos, apenas 1 contato sera criado, e ambos receberao o mesmo `contact_id`.

### Parte 4: Fix retroativo para orfaos existentes

**Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`** ou script one-off

Criar deals para os 126 contatos orfaos dos ultimos 6 dias:
- Buscar contatos sem deal
- Para cada um, verificar se tem transacao A010 em `hubla_transactions`
- Criar deal com as tags e origem corretas
- Esse fix pode ser um script manual ou integrado no `distribute-outside-leads`

## Resultado esperado

- Novos webhooks nunca criam contatos duplicados (unique index)
- Deals sao sempre criados corretamente (mesmo contact_id usado por ambos eventos)
- 126 orfaos existentes sao corrigidos retroativamente
- Problema do Adriano Rodrigues e todos os outros leads de hoje sao resolvidos

## Arquivos alterados
1. **Migration SQL** — unique index parcial em `crm_contacts.email` + limpeza de duplicados
2. `supabase/functions/hubla-webhook-handler/index.ts` — usar upsert atomico na criacao de contato
3. Script retroativo para criar deals dos orfaos (integrado no distribute-outside-leads ou one-off)

