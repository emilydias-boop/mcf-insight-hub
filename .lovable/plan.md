

# Diagnóstico: Leads A010 Sem Deal (Órfãos)

## Descobertas

Investigação no banco revelou um problema significativo de **contatos duplicados** e **deals não criados**:

| Métrica | Quantidade |
|---------|-----------|
| **Contatos órfãos** (A010 pago, sem deal) | **10.863** |
| Desses, têm duplicata com deal | 5.549 (contato duplicado já tem deal) |
| **Verdadeiros órfãos** (sem deal em nenhuma cópia) | **5.314** |
| Órfãos de abril/2026 | 53 |
| Órfãos de março/2026 | 48 |

### Orlando (exemplo): o que aconteceu

- **22:49:17** — Hubla webhook cria transação (source: `hubla`)
- **22:49:18** — Hubla webhook cria contato (com tags `{A010, Hubla}`)
- **22:49:19** — Make webhook cria transação duplicada (source: `hubla_make_sync`)
- O deal **nunca foi criado** para este contato

### Causa raiz: Race condition entre webhooks

O Hubla webhook e o Make webhook disparam quase simultaneamente (~2 segundos de diferença). Ambos tentam criar o contato. Quando o segundo webhook roda, o contato já existe, mas em vários casos, **contatos duplicados** são criados (mesmo email, IDs diferentes). O upsert de deal com `onConflict: 'contact_id,origin_id'` não impede a criação porque o `contact_id` é diferente (duplicata).

Emails com **até 24 cópias** do mesmo contato foram encontrados (ex: kaiorf@gmail.com).

## Solução em 2 partes

### Parte 1: Backfill — Criar deals para órfãos recentes

Edge function que:
1. Busca contatos órfãos (sem deal, com A010 pago) dos últimos 2 meses
2. Para cada um, verifica se existe outro contato com mesmo email que JÁ tem deal → se sim, deleta o contato duplicado
3. Se não existe deal em nenhuma cópia, cria o deal na "PIPELINE INSIDE SALES" com distribuição via `get_next_lead_owner`
4. Roda em batch com log detalhado

### Parte 2: Prevenir novos órfãos no Make webhook

No `webhook-make-a010/index.ts`, na função `createCrmDeal`:
- Antes de criar contato, buscar `crm_contacts` com `ilike('email', ...)` e verificar se **alguma** cópia desse contato já tem deal
- Se já tem deal em outra cópia, usar esse `contact_id` em vez de criar novo
- Isso resolve a race condition na raiz

### Parte 3: Limpeza de duplicatas (futuro)

- Merge de contatos duplicados usando a edge function `merge-duplicate-contacts` já existente
- Isso é um processo maior que pode ser feito separadamente

## Arquivos a modificar

1. **Nova edge function**: `supabase/functions/backfill-orphan-a010-deals/index.ts` — script de backfill
2. **`supabase/functions/webhook-make-a010/index.ts`** — melhorar busca de contato para evitar duplicatas
3. **`supabase/functions/hubla-webhook-handler/index.ts`** — mesma melhoria na busca de contato

## Resultado esperado
- Leads A010 recentes (abril/março) recebem deals e são distribuídos
- Novos A010 não ficam mais órfãos
- Race condition entre webhooks é mitigada

