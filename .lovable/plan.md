

# Correcao: Campo owner_profile_id nao esta sendo salvo na importacao de CSV

## Problema Identificado

Quando o usuario importa negocios via CSV e seleciona um responsavel no formulario, os leads estao chegando **sem owner** porque:

1. O frontend (`ImportarNegocios.tsx`) envia corretamente `owner_email` e `owner_profile_id` para a Edge Function
2. A Edge Function `import-deals-csv` salva esses valores no `metadata` do job
3. A Edge Function `process-csv-imports` le esses valores e monta o objeto `dbDeal` com `owner_id` e `owner_profile_id`
4. **PROBLEMA**: A funcao SQL `upsert_deals_smart` nao inclui o campo `owner_profile_id` na insercao/atualizacao

## Analise do Codigo

### Edge Function (process-csv-imports - linhas 206-218)
```typescript
// Corretamente resolve owner_profile_id
if (finalOwnerEmail) {
  dbDeal.owner_id = finalOwnerEmail
  const resolvedProfileId = ownerProfileId || profilesCache.get(finalOwnerEmail.toLowerCase())
  if (resolvedProfileId) {
    dbDeal.owner_profile_id = resolvedProfileId  // ✅ Campo setado
  }
}
```

### Funcao SQL (upsert_deals_smart - atual)
```sql
INSERT INTO crm_deals (
  clint_id, name, value, stage_id, contact_id,
  origin_id, owner_id,  -- ❌ Falta owner_profile_id
  tags, custom_fields, updated_at, created_at, data_source
)
```

## Solucao

Criar uma nova migracao SQL para atualizar a funcao `upsert_deals_smart` incluindo o campo `owner_profile_id`:

### Migracao SQL
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
      clint_id,
      name,
      value,
      stage_id,
      contact_id,
      origin_id,
      owner_id,
      owner_profile_id,  -- ✅ NOVO
      tags,
      custom_fields,
      updated_at,
      created_at,
      data_source
    )
    VALUES (
      (deal->>'clint_id')::text,
      (deal->>'name')::text,
      (deal->>'value')::numeric,
      (deal->>'stage_id')::uuid,
      (deal->>'contact_id')::uuid,
      (deal->>'origin_id')::uuid,
      (deal->>'owner_id')::text,
      (deal->>'owner_profile_id')::uuid,  -- ✅ NOVO
      CASE 
        WHEN jsonb_typeof(deal->'tags') = 'array' THEN
          (SELECT array_agg(value::text) FROM jsonb_array_elements_text(deal->'tags'))
        ELSE 
          NULL
      END::text[],
      (deal->'custom_fields')::jsonb,
      COALESCE((deal->>'updated_at')::timestamptz, NOW()),
      NOW(),
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
      owner_profile_id = EXCLUDED.owner_profile_id,  -- ✅ NOVO
      tags = EXCLUDED.tags,
      custom_fields = EXCLUDED.custom_fields,
      updated_at = EXCLUDED.updated_at,
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
| Nova migracao SQL | Atualizar funcao `upsert_deals_smart` para incluir `owner_profile_id` |

## Resultado Esperado

Apos a correcao:
- Deals importados via CSV terao `owner_id` (email) E `owner_profile_id` (UUID) populados
- O filtro de ownership no CRM funcionara corretamente
- SDRs e Closers verao os leads atribuidos a eles

## Porque isso e importante

O sistema de filtro do CRM usa `owner_profile_id` (UUID) para filtrar leads por responsavel. Sem esse campo preenchido, os leads importados ficam "orfaos" e nao aparecem na visao do SDR/Closer responsavel.

