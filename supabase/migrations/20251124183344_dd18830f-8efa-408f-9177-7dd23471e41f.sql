-- 1. Adicionar campo data_source na tabela crm_deals
ALTER TABLE crm_deals 
  ADD COLUMN data_source TEXT DEFAULT 'csv' CHECK (data_source IN ('csv', 'webhook', 'manual'));

-- Criar índice para performance
CREATE INDEX idx_crm_deals_data_source ON crm_deals(data_source);

-- 2. Atualizar função upsert_deals_smart para respeitar prioridade do webhook
CREATE OR REPLACE FUNCTION public.upsert_deals_smart(deals_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
      tags = EXCLUDED.tags,
      custom_fields = EXCLUDED.custom_fields,
      updated_at = EXCLUDED.updated_at,
      data_source = 'csv'
    WHERE crm_deals.data_source != 'webhook'
      AND crm_deals.updated_at < EXCLUDED.updated_at;
  END LOOP;
END;
$$;

-- 3. Criar bucket de storage para CSVs
INSERT INTO storage.buckets (id, name, public)
VALUES ('csv-imports', 'csv-imports', false)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS policies para o bucket
CREATE POLICY "Usuários autenticados podem fazer upload de CSV"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'csv-imports');

CREATE POLICY "Usuários autenticados podem ler CSVs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'csv-imports');