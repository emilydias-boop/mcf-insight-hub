
# Plano: Resolver Duplicação de Leads na Importação

## Problema Identificado

O lead "Tiago Raifran" aparece 3 vezes no Kanban porque foram criados **3 deals diferentes** durante a importação CSV:

| Deal ID | clint_id | Estágio | Criado em |
|---------|----------|---------|-----------|
| b646bb38 | f49e825a | VENDA REALIZADA 50K | 02/02 19:06 |
| ac12fa35 | 4a4913c0 | RENOVAÇÃO HUBLA | 02/02 19:02 |
| 42260084 | 8eb79a08 | APORTE HOLDING | 02/02 19:00 |

### Causa Raiz

O arquivo CSV original continha 3 linhas para "Tiago Raifran", cada uma com um `id` (clint_id) diferente. A função `upsert_deals_smart` usa `clint_id` como chave de deduplicação:

```sql
ON CONFLICT (clint_id) DO UPDATE SET ...
```

Como os IDs eram diferentes, o sistema criou 3 deals separados. Todos estão com `contact_id = NULL` porque não foi possível vincular ao contato existente.

---

## Solução Proposta

### Parte 1: Melhorar Deduplicação na Importação (Prevenção)

Modificar a edge function `process-csv-imports` para implementar deduplicação por nome+email quando:
1. O contato é encontrado no cache por nome/email
2. Já existe um deal para aquele contato no mesmo origin_id

**Arquivo:** `supabase/functions/process-csv-imports/index.ts`

Adicionar verificação antes de criar o deal:
```typescript
// Verificar se já existe deal para este contato na mesma origem
const existingDealKey = `${contactId}_${originId}`;
if (processedContactOrigins.has(existingDealKey)) {
  console.log(`⏭️ Pulando deal duplicado para contato ${contactId} na origem ${originId}`);
  chunkSkipped++;
  continue;
}
processedContactOrigins.add(existingDealKey);
```

### Parte 2: Correção de Dados Existentes

Para os deals já duplicados, há duas opções:

**Opção A - Deletar deals duplicados (manual):**
Manter apenas o deal no estágio mais avançado (ex: APORTE HOLDING = ganho)

```sql
-- Listar duplicados por nome na mesma origem
SELECT name, COUNT(*) as total, array_agg(id) as deal_ids
FROM crm_deals 
WHERE origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
GROUP BY name
HAVING COUNT(*) > 1;

-- Deletar deals duplicados (manter o que tem estágio mais avançado)
DELETE FROM crm_deals 
WHERE id IN ('b646bb38-0a94-4ebd-98ec-947cb1406ddc', 'ac12fa35-a4e3-443c-9aa5-acb0d2333533')
  AND origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78';
```

**Opção B - Criar função de merge:**
Uma edge function `merge-duplicate-deals` que identifica e consolida deals duplicados automaticamente.

### Parte 3: Vincular Contatos aos Deals

Os deals estão sem `contact_id`, por isso aparecem sem telefone/email.

```sql
-- Vincular deal do Tiago ao contato existente
UPDATE crm_deals 
SET contact_id = (
  SELECT id FROM crm_contacts 
  WHERE email = 'tiagoraifran@gmail.com' 
  LIMIT 1
)
WHERE name ILIKE '%Tiago Raifran%'
  AND origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
  AND contact_id IS NULL;
```

---

## Fluxo Após Correção

```text
Importação CSV
      |
      v
+------------------+
|  Verificar se    |
|  contato existe  |
+------------------+
      |
      v
+------------------+     Sim    +------------------+
|  Já tem deal     |----------->|  Pular linha     |
|  nesta origem?   |            |  (deduplicar)    |
+------------------+            +------------------+
      | Não
      v
+------------------+
|  Criar deal com  |
|  contact_id      |
|  vinculado       |
+------------------+
```

---

## Arquivos a Modificar

1. **`supabase/functions/process-csv-imports/index.ts`**
   - Adicionar deduplicação por contact_id + origin_id
   - Garantir vinculação do contact_id quando encontrado

2. **Dados existentes (SQL manual ou edge function)**
   - Deletar/mesclar deals duplicados
   - Vincular contact_id aos deals órfãos

---

## Recomendação Imediata

Para resolver o caso do "Tiago Raifran" agora:

1. Manter apenas o deal que representa o estágio atual correto (provavelmente "APORTE HOLDING" se ele já fez o aporte)
2. Deletar os outros dois deals duplicados
3. Vincular o contact_id ao deal mantido

Deseja que eu implemente a correção na importação e forneça as queries SQL para corrigir os dados existentes?

---

## Sobre os Contatos Importados

Você mencionou que vai encaminhar os contatos para subirmos de forma melhor. Ao reimportar:

1. Use um arquivo CSV com uma única linha por lead
2. Inclua a coluna `contact` com email ou nome exato para vincular automaticamente
3. O sistema tentará encontrar o contato existente e vincular o deal
