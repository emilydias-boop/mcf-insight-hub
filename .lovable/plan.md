
# Correcao: Importacao CSV nao captura owner e data de entrada do lead

## Problemas Identificados

Ao analisar o CSV exportado e o codigo de processamento, encontrei **2 problemas**:

### Problema 1: Owner nao capturado do CSV

**Codigo atual (linha 207):**
```typescript
const csvOwnerEmail = csvDeal.owner?.trim() || csvDeal.dono?.trim()
```

**Colunas no CSV real:**
```
user_email: "william.ferreira@minhacasafinanciada.com"
user_name: "WilliamFerreira"
```

O codigo busca pelas colunas `owner` ou `dono`, mas o CSV exportado usa `user_email` para armazenar o email do responsavel.

### Problema 2: Data de criacao nao preservada

**CSV possui:**
```
created_at: "25/08/2025 17:40:59"
```

**Codigo atual:**
- `process-csv-imports` nao le a coluna `created_at` do CSV
- `upsert_deals_smart` sempre usa `NOW()` para created_at

**Resultado:** Todos os deals importados ficam com data de hoje, perdendo o historico original.

## Solucao

Duas alteracoes necessarias:

### 1. Edge Function: Mapear colunas corretas

**Arquivo:** `supabase/functions/process-csv-imports/index.ts`

Adicionar mapeamento para `user_email` e `created_at`:

```typescript
// Linha 8-26 - Adicionar campos ao interface CSVDeal
interface CSVDeal {
  // ... campos existentes ...
  user_email?: string      // NOVO: email do responsavel
  created_at?: string      // NOVO: data original de criacao
}

// Linha 42 - Adicionar created_at ao interface CRMDeal
interface CRMDeal {
  // ... campos existentes ...
  created_at?: string      // NOVO
}

// Linha 207 - Atualizar resolucao de owner
const csvOwnerEmail = csvDeal.owner?.trim() || 
                      csvDeal.dono?.trim() || 
                      csvDeal.user_email?.trim()  // NOVO

// Funcao convertToDBFormat - Adicionar created_at
if (csvDeal.created_at) {
  const parsedDate = parseCSVDate(csvDeal.created_at)
  if (parsedDate) {
    dbDeal.created_at = parsedDate.toISOString()
  }
}

// Nova funcao para parsear datas do CSV
function parseCSVDate(dateStr: string): Date | null {
  // Formato: "25/08/2025 17:40:59"
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (match) {
    const [_, day, month, year, hour, min, sec] = match
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`)
  }
  // Tentar parse direto
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}
```

### 2. Funcao SQL: Preservar data original

**Migracao SQL:** Atualizar `upsert_deals_smart` para usar `created_at` do JSON quando disponivel:

```sql
CREATE OR REPLACE FUNCTION public.upsert_deals_smart(deals_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  deal jsonb;
BEGIN
  FOR deal IN SELECT * FROM jsonb_array_elements(deals_data)
  LOOP
    INSERT INTO crm_deals (
      clint_id, name, value, stage_id, contact_id,
      origin_id, owner_id, owner_profile_id,
      tags, custom_fields, updated_at, created_at, data_source
    )
    VALUES (
      (deal->>'clint_id')::text,
      (deal->>'name')::text,
      (deal->>'value')::numeric,
      (deal->>'stage_id')::uuid,
      (deal->>'contact_id')::uuid,
      (deal->>'origin_id')::uuid,
      (deal->>'owner_id')::text,
      (deal->>'owner_profile_id')::uuid,
      CASE 
        WHEN jsonb_typeof(deal->'tags') = 'array' THEN
          (SELECT array_agg(value::text) FROM jsonb_array_elements_text(deal->'tags'))
        ELSE NULL
      END::text[],
      (deal->'custom_fields')::jsonb,
      COALESCE((deal->>'updated_at')::timestamptz, NOW()),
      COALESCE((deal->>'created_at')::timestamptz, NOW()),  -- ALTERADO: usar data do CSV
      'csv'
    )
    ON CONFLICT (clint_id) 
    DO UPDATE SET
      name = EXCLUDED.name,
      value = EXCLUDED.value,
      stage_id = EXCLUDED.stage_id,
      contact_id = EXCLUDED.contact_id,
      origin_id = EXCLUDED.origin_id,
      owner_id = EXCLUDED.owner_id,
      owner_profile_id = EXCLUDED.owner_profile_id,
      tags = EXCLUDED.tags,
      custom_fields = EXCLUDED.custom_fields,
      updated_at = EXCLUDED.updated_at,
      -- NAO atualiza created_at no UPDATE (preserva data original)
      data_source = 'csv'
    WHERE crm_deals.data_source != 'webhook'
      AND crm_deals.updated_at < EXCLUDED.updated_at;
  END LOOP;
END;
$function$;
```

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/process-csv-imports/index.ts` | Adicionar mapeamento para `user_email` e `created_at` |
| Nova migracao SQL | Atualizar funcao para usar `created_at` do JSON |

## Fluxo Corrigido

```text
CSV                          Edge Function                  SQL Function
┌──────────────────┐        ┌─────────────────────┐        ┌─────────────────────┐
│ user_email:      │   →    │ csvDeal.user_email  │   →    │ owner_id = email    │
│ william@...      │        │ → owner_id          │        │ owner_profile_id =  │
│                  │        │ → owner_profile_id  │        │ profiles.get(email) │
├──────────────────┤        ├─────────────────────┤        ├─────────────────────┤
│ created_at:      │   →    │ parseCSVDate()      │   →    │ COALESCE(           │
│ 25/08/2025       │        │ → created_at        │        │   deal.created_at,  │
│ 17:40:59         │        │   (ISO string)      │        │   NOW()             │
│                  │        │                     │        │ )                   │
└──────────────────┘        └─────────────────────┘        └─────────────────────┘
```

## Resultado Esperado

Apos a correcao:
- William Ferreira e Marceline Cunha aparecerao como owners dos deals
- Datas originais de entrada serao preservadas (ex: 25/08/2025)
- Historico completo do CRM sera mantido na importacao
