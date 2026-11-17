CREATE OR REPLACE FUNCTION public.jornada_resolver_cpf(p_cpf text)
 RETURNS TABLE(deal_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 WITH candidatos AS MATERIALIZED (SELECT * FROM public.jornada_cpf_candidatos()),
 seguros AS (
   SELECT c.deal_id FROM candidatos c JOIN public.crm_deals d ON d.id=c.deal_id
   GROUP BY c.deal_id,d.cpf
   HAVING (count(DISTINCT c.cpf)=1 AND min(c.cpf)=p_cpf AND (nullif(trim(d.cpf),'') IS NULL OR regexp_replace(d.cpf,'[^0-9]','','g')=p_cpf))
       OR (nullif(trim(d.cpf),'') IS NOT NULL AND regexp_replace(d.cpf,'[^0-9]','','g')=p_cpf AND bool_or(c.cpf=p_cpf))
 )
 SELECT s.deal_id FROM seguros s JOIN public.crm_deals d ON d.id=s.deal_id ORDER BY d.created_at DESC,d.id DESC LIMIT 1;
$function$;
UPDATE public.crm_deals SET cpf='11736949608' WHERE id='15024d6b-bde1-4815-8bd0-27d5abdd4722' AND cpf IS NULL;