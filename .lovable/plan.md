

## Diagnóstico: "Bad Request" nos Leads Pendentes R2

### Causa raiz

O hook `useR2PendingLeads.ts` na **Step 3** (linha 113-116) busca todos os deals de todos os contact_ids dos leads com contrato pago. Depois, na **Step 4** (linha 145-152), passa **todos** esses deal_ids num único `.in('deal_id', ...)`. 

O problema é que o número de deal_ids cresceu tanto que a URL da requisição REST excede o limite do Supabase (aproximadamente 4000-8000 caracteres). A rede mostra claramente um `Status: 400 (Bad Request)` nessa query com centenas de UUIDs no filtro.

A mesma situação acontece na Step 3 (`.in('contact_id', ...)` com muitos contact_ids) e na Step 7 (linha 288-300, outra `.in('deal_id', ...)`).

### Solução

**Arquivo: `src/hooks/useR2PendingLeads.ts`**

Criar uma função utilitária `batchedIn` que divide arrays grandes em lotes de ~200 itens e faz múltiplas queries em paralelo, concatenando os resultados. Aplicar em 3 pontos:

1. **Step 3** (linha 113-116): `crm_deals.in('contact_id', ...)` — batch por contact_ids
2. **Step 4** (linha 145-152): `meeting_slot_attendees.in('deal_id', ...)` — batch por deal_ids  
3. **Step 7** (linha 288-300): `meeting_slot_attendees.in('deal_id', ...)` — batch por deal_ids

A função utilitária receberá o array, dividirá em chunks de 200, executará as queries em paralelo com `Promise.all`, e juntará os resultados.

### Resultado
A query não ultrapassará o limite de URL, eliminando o erro "Bad Request".

