
CREATE OR REPLACE FUNCTION public.orfaos_a010_2026()
RETURNS TABLE(email text, nome text, telefone text, oferta text, primeira_compra text)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH inside_emails AS (
    SELECT DISTINCT lower(c.email) AS email
    FROM crm_deals d JOIN crm_contacts c ON c.id=d.contact_id
    JOIN crm_origins o ON o.id=d.origin_id
    WHERE o.name ILIKE '%inside sales%' AND c.email IS NOT NULL
  ), a010 AS (
    SELECT lower(t.customer_email) AS email,
           min(t.customer_name) AS nome,
           min(t.customer_phone) AS telefone,
           min(t.offer_name) AS oferta,
           min(t.sale_date)::text AS primeira_compra
    FROM hubla_transactions t
    WHERE t.sale_date >= '2026-01-01' AND t.sale_date < '2027-01-01'
      AND coalesce(t.installment_number,1) = 1
      AND t.offer_name ILIKE 'PRINCIPAL - A010%'
      AND t.customer_email IS NOT NULL
    GROUP BY lower(t.customer_email)
  )
  SELECT a.email,a.nome,a.telefone,a.oferta,a.primeira_compra
  FROM a010 a LEFT JOIN inside_emails i ON i.email=a.email
  WHERE i.email IS NULL ORDER BY a.primeira_compra
$$;

CREATE OR REPLACE FUNCTION public.orfaos_outside_2026()
RETURNS TABLE(email text, nome text, telefone text, ofertas text, primeira_compra text)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH inside_emails AS (
    SELECT DISTINCT lower(c.email) AS email
    FROM crm_deals d JOIN crm_contacts c ON c.id=d.contact_id
    JOIN crm_origins o ON o.id=d.origin_id
    WHERE o.name ILIKE '%inside sales%' AND c.email IS NOT NULL
  ), outside AS (
    SELECT lower(t.customer_email) AS email,
           min(t.customer_name) AS nome,
           min(t.customer_phone) AS telefone,
           string_agg(DISTINCT t.offer_name, ' | ') AS ofertas,
           min(t.sale_date)::text AS primeira_compra
    FROM hubla_transactions t
    WHERE t.sale_date >= '2026-01-01' AND t.sale_date < '2027-01-01'
      AND t.offer_name IN ('Contrato - Curso R$ 97,00','Contrato Perfil A - Vitrine A010')
      AND t.customer_email IS NOT NULL
    GROUP BY lower(t.customer_email)
  )
  SELECT o.email,o.nome,o.telefone,o.ofertas,o.primeira_compra
  FROM outside o LEFT JOIN inside_emails i ON i.email=o.email
  WHERE i.email IS NULL ORDER BY o.primeira_compra
$$;

REVOKE ALL ON FUNCTION public.orfaos_a010_2026() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orfaos_outside_2026() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orfaos_a010_2026() TO service_role;
GRANT EXECUTE ON FUNCTION public.orfaos_outside_2026() TO service_role;
