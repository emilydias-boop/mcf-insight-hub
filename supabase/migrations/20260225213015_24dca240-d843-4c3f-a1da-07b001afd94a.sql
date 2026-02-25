
-- =====================================================
-- 1. Tabela de histórico de preços
-- =====================================================
CREATE TABLE public.product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_config_id UUID NOT NULL REFERENCES public.product_configurations(id) ON DELETE CASCADE,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_history_config_id ON public.product_price_history(product_config_id);
CREATE INDEX idx_price_history_effective_from ON public.product_price_history(product_config_id, effective_from);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view price history"
  ON public.product_price_history FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert price history"
  ON public.product_price_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- 2. Trigger automático na product_configurations
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.reference_price IS DISTINCT FROM NEW.reference_price THEN
    INSERT INTO product_price_history (product_config_id, old_price, new_price, effective_from, changed_by)
    VALUES (NEW.id, OLD.reference_price, NEW.reference_price, NOW(), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_price_change
  BEFORE UPDATE ON public.product_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_price_change();

-- =====================================================
-- 3. Função para buscar preço vigente na sale_date
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_effective_price(
  p_product_config_id UUID,
  p_sale_date TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Lógica:
  -- 1. Busca a mudança mais recente com effective_from <= sale_date
  --    → Se encontrou, o new_price dessa mudança era o preço vigente
  -- 2. Se sale_date é anterior a TODAS as mudanças, usa old_price da primeira mudança
  -- 3. Se não há histórico, retorna NULL (caller usa reference_price atual como fallback)
  SELECT CASE
    -- Caso 1: Existe mudança anterior ou igual à sale_date → usa new_price da mais recente
    WHEN EXISTS (
      SELECT 1 FROM product_price_history
      WHERE product_config_id = p_product_config_id
        AND effective_from <= p_sale_date
    ) THEN (
      SELECT new_price FROM product_price_history
      WHERE product_config_id = p_product_config_id
        AND effective_from <= p_sale_date
      ORDER BY effective_from DESC
      LIMIT 1
    )
    -- Caso 2: sale_date é anterior a todas as mudanças → usa old_price da primeira
    WHEN EXISTS (
      SELECT 1 FROM product_price_history
      WHERE product_config_id = p_product_config_id
    ) THEN (
      SELECT old_price FROM product_price_history
      WHERE product_config_id = p_product_config_id
      ORDER BY effective_from ASC
      LIMIT 1
    )
    -- Caso 3: Sem histórico → NULL (usa reference_price atual como fallback)
    ELSE NULL
  END;
$$;

-- =====================================================
-- 4. Atualizar RPC get_all_hubla_transactions
-- =====================================================
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer, text[]);

CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000,
  p_products text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  hubla_id text,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  sale_date timestamptz,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_override numeric,
  reference_price numeric,
  linked_attendee_id uuid,
  sale_origin text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id::text,
    ht.product_name::text,
    ht.product_category::text,
    ht.product_price,
    ht.net_value,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.customer_phone::text,
    ht.sale_date,
    ht.sale_status::text,
    ht.installment_number,
    ht.total_installments,
    ht.source::text,
    ht.gross_override,
    COALESCE(
      public.get_effective_price(pc.id, ht.sale_date),
      pc.reference_price
    ) as reference_price,
    ht.linked_attendee_id,
    ht.sale_origin::text
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual', 'make')
    AND NOT (ht.source = 'make' AND LOWER(ht.product_name) IN ('contrato', 'ob construir para alugar'))
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND NOT (
      ht.source = 'make'
      AND ht.product_category = 'parceria'
      AND EXISTS (
        SELECT 1 FROM hubla_transactions h2
        WHERE h2.source = 'hubla'
          AND LOWER(h2.customer_email) = LOWER(ht.customer_email)
          AND h2.sale_date::date = ht.sale_date::date
          AND h2.product_price BETWEEN ht.product_price * 0.95 AND ht.product_price * 1.05
          AND h2.net_value > 0
      )
    )
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
    AND (p_products IS NULL OR ht.product_name = ANY(p_products))
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- 5. Atualizar RPC get_hubla_transactions_by_bu
-- =====================================================
DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(text, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(
  p_bu text,
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  hubla_id text,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  sale_date timestamptz,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_override numeric,
  reference_price numeric,
  linked_attendee_id uuid,
  sale_origin text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id::text,
    ht.product_name::text,
    ht.product_category::text,
    ht.product_price,
    ht.net_value,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.customer_phone::text,
    ht.sale_date,
    ht.sale_status::text,
    ht.installment_number,
    ht.total_installments,
    ht.source::text,
    ht.gross_override,
    COALESCE(
      public.get_effective_price(pc.id, ht.sale_date),
      pc.reference_price
    ) as reference_price,
    ht.linked_attendee_id,
    ht.sale_origin::text
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = p_bu
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
    AND (p_search IS NULL OR 
         ht.customer_name ILIKE '%' || p_search || '%' OR 
         ht.customer_email ILIKE '%' || p_search || '%' OR
         ht.product_name ILIKE '%' || p_search || '%')
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- 6. Seed: registrar preços atuais como baseline
-- =====================================================
INSERT INTO public.product_price_history (product_config_id, old_price, new_price, effective_from, created_at)
SELECT 
  id,
  reference_price,
  reference_price,
  created_at,
  NOW()
FROM public.product_configurations
WHERE reference_price > 0;

-- =====================================================
-- 7. Permissões
-- =====================================================
GRANT EXECUTE ON FUNCTION public.get_effective_price(UUID, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, text, text, integer, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hubla_transactions_by_bu(text, text, text, text, integer) TO anon, authenticated;
